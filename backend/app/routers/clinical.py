from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import Principal, require_staff
from app.models import ClinicalFact, Document, Encounter, Patient, RedFlag, Summary
from app.models.entities import EncounterStatus
from app.schemas.clinical import (
    AcknowledgeRequest,
    ClinicianEncounterResponse,
    EncounterListItem,
    RedFlagResponse,
    TriageQueueItem,
)
from app.schemas.documents import DocumentResponse
from app.schemas.encounters import EncounterResponse, PatientInput
from app.schemas.intake import FactResponse
from app.schemas.summaries import SummaryResponse
from app.services.access import get_encounter_or_404
from app.services.audit import write_audit

triage_router = APIRouter(prefix="/triage", tags=["triage"])
clinician_router = APIRouter(prefix="/clinician", tags=["clinician review"])
red_flag_router = APIRouter(prefix="/red-flags", tags=["triage"])


@triage_router.get("/queue", response_model=list[TriageQueueItem])
async def triage_queue(
    _: Principal = Depends(require_staff("admin", "triage", "physician")),
    session: AsyncSession = Depends(get_session),
) -> list[TriageQueueItem]:
    rows = (
        await session.execute(
            select(Encounter, Patient, RedFlag)
            .join(Patient, Patient.id == Encounter.patient_id)
            .join(RedFlag, RedFlag.encounter_id == Encounter.id)
            .where(RedFlag.active.is_(True))
            .order_by(RedFlag.created_at.asc())
        )
    ).all()
    return [
        TriageQueueItem(
            encounter_id=encounter.id,
            encounter_status=encounter.status.value,
            patient_display_name=patient.display_name,
            red_flag=RedFlagResponse.model_validate(flag),
        )
        for encounter, patient, flag in rows
    ]


@triage_router.get("/encounters", response_model=list[EncounterListItem])
async def list_all_encounters(
    _: Principal = Depends(require_staff("admin", "triage", "physician")),
    session: AsyncSession = Depends(get_session),
    limit: int = 100,
) -> list[EncounterListItem]:
    """List the most recent encounters for the admin/triage dashboard, regardless of red-flag status."""
    active_flag_subq = (
        select(func.count())
        .select_from(RedFlag)
        .where(RedFlag.encounter_id == Encounter.id, RedFlag.active.is_(True))
        .correlate(Encounter)
        .scalar_subquery()
    )
    rows = (
        await session.execute(
            select(Encounter, Patient, active_flag_subq.label("flag_count"))
            .join(Patient, Patient.id == Encounter.patient_id)
            .order_by(Encounter.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [
        EncounterListItem(
            encounter_id=encounter.id,
            encounter_status=encounter.status.value,
            pathway_version=encounter.pathway_version,
            patient_display_name=patient.display_name,
            patient_birth_year=patient.birth_year,
            patient_sex=patient.sex,
            patient_abha_identifier=patient.abha_identifier,
            patient_respondent_type=patient.respondent_type,
            patient_caregiver_relationship=patient.caregiver_relationship,
            has_active_red_flag=flag_count > 0,
            created_at=encounter.created_at,
            submitted_at=encounter.submitted_at,
        )
        for encounter, patient, flag_count in rows
    ]


@red_flag_router.post("/{red_flag_id}/acknowledgements", response_model=RedFlagResponse)
async def acknowledge_red_flag(
    red_flag_id: UUID,
    payload: AcknowledgeRequest,
    request: Request,
    principal: Principal = Depends(require_staff("admin", "triage", "physician")),
    session: AsyncSession = Depends(get_session),
) -> RedFlagResponse:
    flag = await session.get(RedFlag, red_flag_id)
    if flag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Red flag not found")
    if flag.acknowledged_at is None:
        flag.acknowledged_by = principal.subject
        flag.acknowledged_at = datetime.now(UTC)
        await write_audit(
            session,
            "red_flag.acknowledged",
            actor_id=principal.subject,
            encounter_id=flag.encounter_id,
            request=request,
            metadata={"red_flag_id": str(flag.id), "note": payload.note},
        )
        await session.commit()
        await session.refresh(flag)
    return RedFlagResponse.model_validate(flag)


@clinician_router.get("/encounters/{encounter_id}", response_model=ClinicianEncounterResponse)
async def clinician_encounter(
    encounter_id: UUID,
    request: Request,
    principal: Principal = Depends(require_staff("admin", "triage", "physician")),
    session: AsyncSession = Depends(get_session),
) -> ClinicianEncounterResponse:
    encounter = await get_encounter_or_404(session, encounter_id)
    if encounter.status == EncounterStatus.submitted:
        encounter.status = EncounterStatus.in_review
    patient = await session.get(Patient, encounter.patient_id)
    facts = (
        await session.scalars(
            select(ClinicalFact)
            .where(ClinicalFact.encounter_id == encounter_id)
            .order_by(ClinicalFact.created_at)
        )
    ).all()
    flags = (await session.scalars(select(RedFlag).where(RedFlag.encounter_id == encounter_id))).all()
    documents = (await session.scalars(select(Document).where(Document.encounter_id == encounter_id))).all()
    summary = await session.scalar(
        select(Summary).where(Summary.encounter_id == encounter_id).order_by(Summary.created_at.desc())
    )
    await write_audit(
        session,
        "clinician.encounter_viewed",
        actor_id=principal.subject,
        encounter_id=encounter_id,
        request=request,
    )
    await session.commit()
    return ClinicianEncounterResponse(
        encounter=EncounterResponse.model_validate(encounter),
        patient=PatientInput.model_validate(patient) if patient else None,
        facts=[FactResponse.model_validate(fact) for fact in facts],
        red_flags=[RedFlagResponse.model_validate(flag) for flag in flags],
        documents=[DocumentResponse.model_validate(document) for document in documents],
        summary=SummaryResponse.model_validate(summary) if summary else None,
    )
