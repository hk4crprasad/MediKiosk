"""Patient portal: a registered patient's own document archive, and the staff-facing
search/profile view over it. Deliberately separate from the kiosk Encounter/Document
subsystem — see app/models/entities.py's "Patient portal" section for why."""

from datetime import date
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.core.errors import DomainError
from app.core.security import (
    Principal,
    create_token,
    get_principal,
    hash_password,
    require_patient,
    require_staff,
    verify_password,
)
from app.models import (
    PatientAccount,
    PatientHistorySummary,
    PatientRecord,
    PatientRecordExtraction,
    RevokedToken,
)
from app.models.entities import DocumentStatus
from app.schemas.assistive import DocumentExtractionRequest
from app.schemas.patients import (
    PatientAccountResponse,
    PatientHistorySummaryResponse,
    PatientLoginRequest,
    PatientRecordExtractionResponse,
    PatientRecordResponse,
    PatientRegisterRequest,
    PatientTokenResponse,
    StaffPatientProfileResponse,
    StaffPatientSearchResult,
)
from app.services.assistive import OpenAICompatibleVisionExtractor, mock_document_extraction
from app.services.audit import write_audit
from app.services.document_validation import ALLOWED_MIME_TYPES, has_expected_file_signature, safe_filename
from app.services.patient_summaries import generate_patient_history_summary
from app.services.storage import AzureBlobDocumentStorage

router = APIRouter(prefix="/patients", tags=["patient-portal"])
staff_router = APIRouter(prefix="/staff/patients", tags=["patient-portal"])

ALLOWED_RECORD_TYPES = {"prescription", "lab_report", "discharge_summary", "other"}


def ensure_own_record(principal: Principal, record: PatientRecord) -> None:
    if record.patient_account_id != principal.subject:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access this record")


# --- Registration / login --------------------------------------------------


@router.post("/register", response_model=PatientTokenResponse, status_code=status.HTTP_201_CREATED)
async def register_patient(
    payload: PatientRegisterRequest, request: Request, session: AsyncSession = Depends(get_session)
) -> PatientTokenResponse:
    existing = await session.scalar(select(PatientAccount).where(PatientAccount.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    account = PatientAccount(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        birth_year=payload.birth_year,
        sex=payload.sex,
        abha_identifier=payload.abha_identifier or None,
    )
    session.add(account)
    await session.flush()
    settings = get_settings()
    token = create_token(account.id, "patient", "patient", settings.patient_token_expire_minutes)
    await write_audit(session, "patient.registered", actor_id=account.id, request=request)
    await session.commit()
    return PatientTokenResponse(
        access_token=token, expires_in_seconds=settings.patient_token_expire_minutes * 60
    )


@router.post("/login", response_model=PatientTokenResponse)
async def login_patient(
    payload: PatientLoginRequest, request: Request, session: AsyncSession = Depends(get_session)
) -> PatientTokenResponse:
    account = await session.scalar(select(PatientAccount).where(PatientAccount.email == payload.email.lower()))
    if account is None or not account.active or not verify_password(payload.password, account.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    settings = get_settings()
    token = create_token(account.id, "patient", "patient", settings.patient_token_expire_minutes)
    await write_audit(session, "patient.login", actor_id=account.id, request=request)
    await session.commit()
    return PatientTokenResponse(
        access_token=token, expires_in_seconds=settings.patient_token_expire_minutes * 60
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_patient(
    request: Request,
    principal: Principal = Depends(require_patient),
    session: AsyncSession = Depends(get_session),
) -> None:
    revoked = await session.scalar(select(RevokedToken).where(RevokedToken.token_id == principal.token_id))
    if revoked is None:
        session.add(
            RevokedToken(
                token_id=principal.token_id,
                actor_id=principal.subject,
                expires_at=principal.token_expires_at,
            )
        )
    await write_audit(session, "patient.logout", actor_id=principal.subject, request=request)
    await session.commit()


@router.get("/me", response_model=PatientAccountResponse)
async def get_me(
    principal: Principal = Depends(require_patient), session: AsyncSession = Depends(get_session)
) -> PatientAccountResponse:
    account = await session.get(PatientAccount, principal.subject)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return PatientAccountResponse.model_validate(account)


# --- Records -----------------------------------------------------------


@router.post("/records", response_model=PatientRecordResponse, status_code=status.HTTP_201_CREATED)
async def upload_record(
    request: Request,
    file: UploadFile = File(...),
    document_type: str = Form(default="other"),
    visit_date: str | None = Form(default=None),
    hospital_or_clinic: str | None = Form(default=None),
    visit_reason: str | None = Form(default=None),
    principal: Principal = Depends(require_patient),
    session: AsyncSession = Depends(get_session),
) -> PatientRecordResponse:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF, JPEG, and PNG files are accepted",
        )
    if document_type not in ALLOWED_RECORD_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported document type")
    settings = get_settings()
    content = await file.read(settings.max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Uploaded file is empty")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large")
    if not has_expected_file_signature(content, file.content_type):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File content does not match its declared type",
        )
    parsed_visit_date = None
    if visit_date:
        try:
            parsed_visit_date = date.fromisoformat(visit_date)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="visit_date must be YYYY-MM-DD"
            ) from exc

    # AI relevance gate: reject and persist nothing (no blob, no DB row) if the file is
    # not a medical document. Only enforced when real vision classification is
    # configured — like the rest of the app's AI features, an unavailable/misconfigured
    # provider falls back to allowing manual review rather than blocking the patient.
    if settings.ocr_adapter_mode.strip().lower() == "openai_compatible":
        try:
            relevance = await OpenAICompatibleVisionExtractor(settings).check_medical_relevance(
                content, file.content_type
            )
        except DomainError:
            relevance = None
        if relevance is not None and not relevance.is_medical_document:
            await write_audit(
                session,
                "patient.record_upload_rejected_not_medical",
                actor_id=principal.subject,
                request=request,
                metadata={"reason": relevance.reason},
            )
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"This file does not appear to be a medical document: {relevance.reason}",
            )

    storage_key = f"patient-records/{principal.subject}/{uuid4()}-{safe_filename(file.filename or 'upload')}"
    storage = AzureBlobDocumentStorage(settings)
    await storage.upload(storage_key, content, file.content_type)
    record = PatientRecord(
        patient_account_id=principal.subject,
        visit_date=parsed_visit_date,
        hospital_or_clinic=hospital_or_clinic,
        visit_reason=visit_reason,
        document_type=document_type,
        storage_key=storage_key,
        original_filename=safe_filename(file.filename or "upload"),
        mime_type=file.content_type,
        size_bytes=len(content),
        processing_status=DocumentStatus.uploaded,
    )
    session.add(record)
    await session.flush()
    await write_audit(
        session,
        "patient.record_uploaded",
        actor_id=principal.subject,
        request=request,
        metadata={"document_type": document_type, "record_id": str(record.id)},
    )
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        await storage.delete(storage_key)
        raise
    await session.refresh(record)
    return PatientRecordResponse.model_validate(record)


@router.get("/records", response_model=list[PatientRecordResponse])
async def list_my_records(
    principal: Principal = Depends(require_patient), session: AsyncSession = Depends(get_session)
) -> list[PatientRecordResponse]:
    records = (
        await session.scalars(
            select(PatientRecord)
            .where(PatientRecord.patient_account_id == principal.subject)
            .order_by(PatientRecord.created_at.desc())
        )
    ).all()
    return [PatientRecordResponse.model_validate(record) for record in records]


async def get_record_or_404(session: AsyncSession, record_id: UUID) -> PatientRecord:
    record = await session.get(PatientRecord, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
    return record


@router.get("/records/{record_id}/content", response_class=StreamingResponse)
async def download_record_content(
    record_id: UUID,
    principal: Principal = Depends(require_patient),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    record = await get_record_or_404(session, record_id)
    ensure_own_record(principal, record)
    stream = await AzureBlobDocumentStorage(get_settings()).download(record.storage_key)
    headers = {"Content-Disposition": f'attachment; filename="{record.original_filename}"'}
    return StreamingResponse(stream, media_type=record.mime_type, headers=headers)


@router.post(
    "/records/{record_id}/extractions",
    response_model=PatientRecordExtractionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_record_extraction(
    record_id: UUID,
    payload: DocumentExtractionRequest,
    request: Request,
    principal: Principal = Depends(require_patient),
    session: AsyncSession = Depends(get_session),
) -> PatientRecordExtractionResponse:
    record = await get_record_or_404(session, record_id)
    ensure_own_record(principal, record)
    settings = get_settings()
    adapter_mode = settings.ocr_adapter_mode.strip().lower()
    record.processing_status = DocumentStatus.processing
    await session.commit()
    try:
        if adapter_mode == "mock":
            output = mock_document_extraction(adapter_mode, payload.fixture_id)
        elif adapter_mode == "openai_compatible":
            extractor = OpenAICompatibleVisionExtractor(settings)
            stream = await AzureBlobDocumentStorage(settings).download(record.storage_key)
            source_content = b"".join([chunk async for chunk in stream])
            if record.mime_type in {"image/jpeg", "image/png"}:
                output = await extractor.extract_image(source_content, record.mime_type, record.document_type)
            elif record.mime_type == "application/pdf":
                output = await extractor.extract_pdf(source_content, record.document_type)
            else:
                raise DomainError(
                    code="vision_extraction_unsupported_document",
                    message="Extraction supports PDF, JPEG, and PNG documents only.",
                    status_code=422,
                )
        elif adapter_mode == "disabled":
            raise DomainError(
                code="ocr_adapter_unavailable",
                message="Document extraction is disabled; use manual review.",
                status_code=503,
            )
        else:
            raise DomainError(
                code="ocr_adapter_misconfigured",
                message="Document extraction mode is invalid; use disabled, mock, or openai_compatible.",
                status_code=503,
            )
    except DomainError:
        record.processing_status = DocumentStatus.failed
        await write_audit(
            session,
            "patient.record_extraction_failed",
            actor_id=principal.subject,
            request=request,
            metadata={"record_id": str(record.id), "provider_mode": adapter_mode},
        )
        await session.commit()
        raise
    extraction = PatientRecordExtraction(
        patient_record_id=record.id,
        provider=output.provider,
        status="COMPLETED",
        raw_text=output.raw_text,
        structured_data=output.structured_data,
        confidence=output.confidence,
    )
    record.processing_status = DocumentStatus.processed
    session.add(extraction)
    await session.flush()
    await write_audit(
        session,
        "patient.record_extraction_created",
        actor_id=principal.subject,
        request=request,
        metadata={"extraction_id": str(extraction.id), "record_id": str(record.id), "provider": output.provider},
    )
    await session.commit()
    await session.refresh(extraction)
    return PatientRecordExtractionResponse.model_validate(extraction)


# --- Longitudinal AI summary --------------------------------------------


@router.post("/summary/generate", response_model=PatientHistorySummaryResponse)
async def generate_my_summary(
    principal: Principal = Depends(require_patient), session: AsyncSession = Depends(get_session)
) -> PatientHistorySummaryResponse:
    summary = await generate_patient_history_summary(session, principal.subject)
    await session.commit()
    await session.refresh(summary)
    return PatientHistorySummaryResponse.model_validate(summary)


@router.get("/summary", response_model=PatientHistorySummaryResponse | None)
async def get_my_latest_summary(
    principal: Principal = Depends(require_patient), session: AsyncSession = Depends(get_session)
) -> PatientHistorySummaryResponse | None:
    summary = await session.scalar(
        select(PatientHistorySummary)
        .where(PatientHistorySummary.patient_account_id == principal.subject)
        .order_by(PatientHistorySummary.created_at.desc())
    )
    return PatientHistorySummaryResponse.model_validate(summary) if summary else None


# --- Staff search --------------------------------------------------------


@staff_router.get("", response_model=list[StaffPatientSearchResult])
async def search_patients(
    query: str = "",
    _: Principal = Depends(require_staff("admin", "triage", "physician")),
    session: AsyncSession = Depends(get_session),
) -> list[StaffPatientSearchResult]:
    stmt = select(PatientAccount).order_by(PatientAccount.created_at.desc()).limit(50)
    if query.strip():
        like = f"%{query.strip()}%"
        stmt = select(PatientAccount).where(
            or_(
                PatientAccount.email.ilike(like),
                PatientAccount.display_name.ilike(like),
                PatientAccount.abha_identifier == query.strip(),
            )
        ).order_by(PatientAccount.created_at.desc()).limit(50)
    accounts = (await session.scalars(stmt)).all()
    results = []
    for account in accounts:
        record_count = await session.scalar(
            select(func.count()).select_from(PatientRecord).where(PatientRecord.patient_account_id == account.id)
        )
        last_record = await session.scalar(
            select(PatientRecord.created_at)
            .where(PatientRecord.patient_account_id == account.id)
            .order_by(PatientRecord.created_at.desc())
            .limit(1)
        )
        results.append(
            StaffPatientSearchResult(
                id=account.id,
                email=account.email,
                display_name=account.display_name,
                abha_identifier=account.abha_identifier,
                record_count=record_count or 0,
                last_activity_at=last_record,
            )
        )
    return results


@staff_router.get("/{patient_account_id}", response_model=StaffPatientProfileResponse)
async def get_patient_profile(
    patient_account_id: UUID,
    _: Principal = Depends(require_staff("admin", "triage", "physician")),
    session: AsyncSession = Depends(get_session),
) -> StaffPatientProfileResponse:
    account = await session.get(PatientAccount, patient_account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient account not found")
    records = (
        await session.scalars(
            select(PatientRecord)
            .where(PatientRecord.patient_account_id == patient_account_id)
            .order_by(PatientRecord.created_at.desc())
        )
    ).all()
    summary = await session.scalar(
        select(PatientHistorySummary)
        .where(PatientHistorySummary.patient_account_id == patient_account_id)
        .order_by(PatientHistorySummary.created_at.desc())
    )
    return StaffPatientProfileResponse(
        account=PatientAccountResponse.model_validate(account),
        records=[PatientRecordResponse.model_validate(record) for record in records],
        summary=PatientHistorySummaryResponse.model_validate(summary) if summary else None,
    )


@staff_router.post("/{patient_account_id}/summary/generate", response_model=PatientHistorySummaryResponse)
async def generate_patient_profile_summary(
    patient_account_id: UUID,
    _: Principal = Depends(require_staff("admin", "physician")),
    session: AsyncSession = Depends(get_session),
) -> PatientHistorySummaryResponse:
    account = await session.get(PatientAccount, patient_account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient account not found")
    summary = await generate_patient_history_summary(session, patient_account_id)
    await session.commit()
    await session.refresh(summary)
    return PatientHistorySummaryResponse.model_validate(summary)
