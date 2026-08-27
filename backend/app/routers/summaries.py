from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import Principal, require_staff
from app.models import ClinicalFact, PhysicianRevision, Summary
from app.models.entities import EncounterStatus, SummaryStatus, VerificationStatus
from app.schemas.summaries import SummaryResponse, SummaryUpdateRequest, SummaryVerificationRequest
from app.services.access import get_encounter_or_404
from app.services.audit import write_audit
from app.services.summaries import generate_summary as generate_summary_draft

router = APIRouter(prefix="/encounters/{encounter_id}/summary", tags=["summary"])


async def latest_summary(session: AsyncSession, encounter_id: UUID) -> Summary:
    summary = await session.scalar(
        select(Summary).where(Summary.encounter_id == encounter_id).order_by(Summary.created_at.desc())
    )
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Summary not found")
    return summary


@router.post("/generations", response_model=SummaryResponse, status_code=status.HTTP_201_CREATED)
async def generate_summary(
    encounter_id: UUID,
    request: Request,
    principal: Principal = Depends(require_staff("admin", "physician")),
    session: AsyncSession = Depends(get_session),
) -> SummaryResponse:
    await get_encounter_or_404(session, encounter_id)
    summary = await generate_summary_draft(session, encounter_id)
    await write_audit(
        session,
        "summary.generated",
        actor_id=principal.subject,
        encounter_id=encounter_id,
        request=request,
        metadata={"summary_id": str(summary.id), **summary.prompt_metadata},
    )
    await session.commit()
    await session.refresh(summary)
    return SummaryResponse.model_validate(summary)


@router.get("", response_model=SummaryResponse)
async def get_summary(
    encounter_id: UUID,
    _: Principal = Depends(require_staff("admin", "triage", "physician")),
    session: AsyncSession = Depends(get_session),
) -> SummaryResponse:
    return SummaryResponse.model_validate(await latest_summary(session, encounter_id))


@router.patch("", response_model=SummaryResponse)
async def update_summary(
    encounter_id: UUID,
    payload: SummaryUpdateRequest,
    request: Request,
    principal: Principal = Depends(require_staff("admin", "physician")),
    session: AsyncSession = Depends(get_session),
) -> SummaryResponse:
    summary = await latest_summary(session, encounter_id)
    revision = PhysicianRevision(
        encounter_id=encounter_id,
        summary_id=summary.id,
        old_value=summary.text,
        new_value=payload.text,
        doctor_id=principal.subject,
    )
    session.add(revision)
    summary.text = payload.text
    await write_audit(session, "summary.edited", actor_id=principal.subject, encounter_id=encounter_id, request=request)
    await session.commit()
    await session.refresh(summary)
    return SummaryResponse.model_validate(summary)


@router.post("/verifications", response_model=SummaryResponse)
async def verify_summary(
    encounter_id: UUID,
    payload: SummaryVerificationRequest,
    request: Request,
    principal: Principal = Depends(require_staff("admin", "physician")),
    session: AsyncSession = Depends(get_session),
) -> SummaryResponse:
    encounter = await get_encounter_or_404(session, encounter_id)
    summary = await latest_summary(session, encounter_id)
    summary.status = SummaryStatus.accepted if payload.decision == "accept" else SummaryStatus.rejected
    if payload.decision == "accept":
        encounter.status = EncounterStatus.verified
        encounter.physician_verified_at = datetime.now(UTC)
        facts = (
            await session.scalars(select(ClinicalFact).where(ClinicalFact.encounter_id == encounter_id))
        ).all()
        for fact in facts:
            fact.verification_status = VerificationStatus.clinician_verified
    await write_audit(
        session,
        "summary.verified",
        actor_id=principal.subject,
        encounter_id=encounter_id,
        request=request,
        metadata={"decision": payload.decision},
    )
    await session.commit()
    await session.refresh(summary)
    return SummaryResponse.model_validate(summary)
