from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clinical_config.pathways import is_supported_pathway, supported_pathway_versions
from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import Principal, create_token, get_principal
from app.models import Consent, Encounter, Patient
from app.models.entities import EncounterStatus
from app.schemas.encounters import (
    ConsentCreateRequest,
    ConsentResponse,
    ConsentRevocationResponse,
    EncounterCreatedResponse,
    EncounterCreateRequest,
    EncounterResponse,
)
from app.services.access import ensure_encounter_access, get_encounter_or_404
from app.services.audit import write_audit

router = APIRouter(prefix="/encounters", tags=["encounters"])


@router.post("", response_model=EncounterCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_encounter(
    payload: EncounterCreateRequest, request: Request, session: AsyncSession = Depends(get_session)
) -> EncounterCreatedResponse:
    if not is_supported_pathway(payload.pathway_version):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Unsupported pathway version",
                "supported_pathway_versions": supported_pathway_versions(),
            },
        )
    patient = Patient(**payload.patient.model_dump())
    session.add(patient)
    await session.flush()
    encounter = Encounter(patient_id=patient.id, mode=payload.mode, pathway_version=payload.pathway_version)
    session.add(encounter)
    await session.flush()
    settings = get_settings()
    kiosk_subject = uuid4()
    token = create_token(
        kiosk_subject,
        "kiosk",
        "kiosk",
        settings.kiosk_token_expire_minutes,
        encounter_id=encounter.id,
    )
    await write_audit(
        session,
        "encounter.created",
        encounter_id=encounter.id,
        request=request,
        metadata={"mode": payload.mode},
    )
    await session.commit()
    await session.refresh(encounter)
    return EncounterCreatedResponse(
        encounter=EncounterResponse.model_validate(encounter),
        kiosk_session_token=token,
        kiosk_token_expires_in_seconds=settings.kiosk_token_expire_minutes * 60,
    )


@router.get("/{encounter_id}", response_model=EncounterResponse)
async def get_encounter(
    encounter_id: UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> EncounterResponse:
    ensure_encounter_access(principal, encounter_id)
    encounter = await get_encounter_or_404(session, encounter_id)
    return EncounterResponse.model_validate(encounter)


@router.post("/{encounter_id}/consents", response_model=ConsentResponse, status_code=status.HTTP_201_CREATED)
async def create_consent(
    encounter_id: UUID,
    payload: ConsentCreateRequest,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> ConsentResponse:
    ensure_encounter_access(principal, encounter_id)
    encounter = await get_encounter_or_404(session, encounter_id)
    existing = await session.scalar(
        select(Consent).where(
            Consent.encounter_id == encounter_id,
            Consent.consent_type == payload.consent_type,
            Consent.version == payload.version,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Consent receipt already exists for this version"
        )
    consent = Consent(encounter_id=encounter_id, **payload.model_dump())
    session.add(consent)
    if (
        payload.consent_type == "clinical_intake"
        and payload.granted
        and encounter.status == EncounterStatus.draft
    ):
        encounter.status = EncounterStatus.in_progress
    await write_audit(
        session,
        "consent.recorded",
        actor_id=principal.subject if principal.token_type == "staff" else None,
        encounter_id=encounter_id,
        request=request,
        metadata={
            "consent_type": payload.consent_type,
            "version": payload.version,
            "granted": payload.granted,
        },
    )
    await session.commit()
    await session.refresh(consent)
    return ConsentResponse.model_validate(consent)


@router.get("/{encounter_id}/consents", response_model=list[ConsentResponse])
async def list_consents(
    encounter_id: UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> list[ConsentResponse]:
    ensure_encounter_access(principal, encounter_id)
    await get_encounter_or_404(session, encounter_id)
    consents = (
        await session.scalars(
            select(Consent).where(Consent.encounter_id == encounter_id).order_by(Consent.created_at.asc())
        )
    ).all()
    return [ConsentResponse.model_validate(consent) for consent in consents]


@router.post("/{encounter_id}/consents/{consent_id}/revocations", response_model=ConsentRevocationResponse)
async def revoke_consent(
    encounter_id: UUID,
    consent_id: UUID,
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> ConsentRevocationResponse:
    ensure_encounter_access(principal, encounter_id)
    consent = await session.scalar(
        select(Consent).where(Consent.id == consent_id, Consent.encounter_id == encounter_id)
    )
    if consent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consent receipt not found")
    if consent.revoked_at is None:
        consent.revoked_at = datetime.now(UTC)
        await write_audit(
            session,
            "consent.revoked",
            actor_id=principal.subject if principal.token_type == "staff" else None,
            encounter_id=encounter_id,
            request=request,
            metadata={"consent_id": str(consent_id)},
        )
        await session.commit()
        await session.refresh(consent)
    return ConsentRevocationResponse.model_validate(consent)
