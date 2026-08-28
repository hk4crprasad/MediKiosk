from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clinical_config.pathways import localise_fact_display, localise_question
from app.core.database import get_session
from app.core.security import Principal, get_principal
from app.models import ClinicalFact, Patient
from app.models.entities import EncounterStatus
from app.schemas.encounters import EncounterResponse
from app.schemas.intake import (
    FactResponse,
    IntakeResponseCreateRequest,
    IntakeResponseResult,
    QuestionResponse,
    SubmitResponse,
)
from app.services.access import ensure_encounter_access, get_encounter_or_404
from app.services.audit import write_audit
from app.services.intake import ensure_active_consent, next_question, required_missing, submit_response

router = APIRouter(prefix="/encounters/{encounter_id}", tags=["intake"])


@router.get("/intake/next-question", response_model=QuestionResponse | None)
async def get_next_question(
    encounter_id: UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> QuestionResponse | None:
    ensure_encounter_access(principal, encounter_id)
    encounter = await get_encounter_or_404(session, encounter_id)
    await ensure_active_consent(session, encounter_id)
    question = await next_question(session, encounter)
    if question is None:
        return None
    patient = await session.get(Patient, encounter.patient_id)
    language = patient.preferred_language if patient else "en"
    return QuestionResponse(
        **localise_question(question, language), pathway_version=encounter.pathway_version
    )


@router.post("/intake/responses", response_model=IntakeResponseResult, status_code=status.HTTP_201_CREATED)
async def create_intake_response(
    encounter_id: UUID,
    payload: IntakeResponseCreateRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> IntakeResponseResult:
    ensure_encounter_access(principal, encounter_id)
    encounter = await get_encounter_or_404(session, encounter_id)
    response, facts, flags = await submit_response(session, encounter, payload)
    await write_audit(
        session,
        "intake.response_recorded",
        actor_id=principal.subject if principal.token_type == "staff" else None,
        encounter_id=encounter_id,
        request=request,
        metadata={"question_key": payload.question_key, "input_mode": payload.input_mode},
    )
    await session.commit()
    return IntakeResponseResult(
        response_id=response.id,
        encounter_status=encounter.status,
        created_facts=[FactResponse.model_validate(fact) for fact in facts],
        active_red_flag_ids=[flag.id for flag in flags],
    )


@router.get("/facts", response_model=list[FactResponse])
async def list_facts(
    encounter_id: UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> list[FactResponse]:
    ensure_encounter_access(principal, encounter_id)
    encounter = await get_encounter_or_404(session, encounter_id)
    patient = await session.get(Patient, encounter.patient_id)
    language = patient.preferred_language if patient else "en"
    facts = (
        await session.scalars(
            select(ClinicalFact)
            .where(ClinicalFact.encounter_id == encounter_id)
            .order_by(ClinicalFact.created_at.asc())
        )
    ).all()
    responses = []
    for fact in facts:
        display_label, display_value = localise_fact_display(
            fact.fact_type, fact.value.get("value"), language
        )
        responses.append(
            FactResponse.model_validate(fact).model_copy(
                update={"display_label": display_label, "display_value": display_value}
            )
        )
    return responses


@router.post("/submit", response_model=SubmitResponse)
async def finalize_intake(
    encounter_id: UUID,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> SubmitResponse:
    ensure_encounter_access(principal, encounter_id)
    encounter = await get_encounter_or_404(session, encounter_id)
    await ensure_active_consent(session, encounter_id)
    missing = await required_missing(session, encounter)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "Required intake fields are missing", "missing_question_keys": missing},
        )
    if encounter.status != EncounterStatus.urgent_review:
        encounter.status = EncounterStatus.submitted
    encounter.submitted_at = datetime.now(UTC)
    await write_audit(session, "intake.submitted", encounter_id=encounter_id, request=request)
    await session.commit()
    await session.refresh(encounter)
    return SubmitResponse(encounter=EncounterResponse.model_validate(encounter), missing_question_keys=[])
