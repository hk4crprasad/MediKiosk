from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import Principal, get_principal, require_staff
from app.models import AssistiveArtifact, ClinicalFact, Document
from app.models.entities import DocumentStatus
from app.schemas.documents import DocumentResponse, DocumentTimelineItem
from app.services.access import ensure_encounter_access, get_encounter_or_404
from app.services.audit import write_audit
from app.services.document_validation import (
    ALLOWED_MIME_TYPES,
    has_expected_file_signature,
    safe_filename,
)
from app.services.intake import ensure_active_consent
from app.services.storage import AzureBlobDocumentStorage

router = APIRouter(tags=["documents"])


@router.post(
    "/encounters/{encounter_id}/documents",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    encounter_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    document_type: str = Form(default="other"),
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> DocumentResponse:
    ensure_encounter_access(principal, encounter_id)
    await get_encounter_or_404(session, encounter_id)
    await ensure_active_consent(session, encounter_id)
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF, JPEG, and PNG files are accepted",
        )
    if document_type not in {"prescription", "lab_report", "discharge_summary", "other"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported document type"
        )
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
    storage_key = f"{encounter_id}/{uuid4()}-{safe_filename(file.filename or 'upload')}"
    storage = AzureBlobDocumentStorage(settings)
    await storage.upload(storage_key, content, file.content_type)
    document = Document(
        encounter_id=encounter_id,
        document_type=document_type,
        storage_key=storage_key,
        original_filename=safe_filename(file.filename or "upload"),
        mime_type=file.content_type,
        size_bytes=len(content),
        processing_status=DocumentStatus.uploaded,
    )
    session.add(document)
    await session.flush()
    await write_audit(
        session,
        "document.uploaded",
        actor_id=principal.subject if principal.token_type == "staff" else None,
        encounter_id=encounter_id,
        request=request,
        metadata={"document_type": document_type, "document_id": str(document.id)},
    )
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        await storage.delete(storage_key)
        raise
    await session.refresh(document)
    return DocumentResponse.model_validate(document)


@router.get("/encounters/{encounter_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    encounter_id: UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> list[DocumentResponse]:
    ensure_encounter_access(principal, encounter_id)
    documents = (
        await session.scalars(
            select(Document).where(Document.encounter_id == encounter_id).order_by(Document.created_at.desc())
        )
    ).all()
    return [DocumentResponse.model_validate(document) for document in documents]


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> DocumentResponse:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    ensure_encounter_access(principal, document.encounter_id)
    return DocumentResponse.model_validate(document)


@router.get("/documents/{document_id}/content", response_class=StreamingResponse)
async def download_document_content(
    document_id: UUID,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Return the original source file only after encounter-scoped authorisation."""
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    ensure_encounter_access(principal, document.encounter_id)
    stream = await AzureBlobDocumentStorage(get_settings()).download(document.storage_key)
    headers = {"Content-Disposition": f'attachment; filename="{document.original_filename}"'}
    return StreamingResponse(stream, media_type=document.mime_type, headers=headers)


@router.get("/encounters/{encounter_id}/document-timeline", response_model=list[DocumentTimelineItem])
async def document_timeline(
    encounter_id: UUID,
    principal: Principal = Depends(require_staff("admin", "physician")),
    session: AsyncSession = Depends(get_session),
) -> list[DocumentTimelineItem]:
    """Return document evidence history, never an AI-generated clinical narrative."""
    await get_encounter_or_404(session, encounter_id)
    documents = (
        await session.scalars(
            select(Document).where(Document.encounter_id == encounter_id).order_by(Document.created_at)
        )
    ).all()
    document_ids = [document.id for document in documents]
    if not document_ids:
        return []
    artifacts = (
        await session.scalars(
            select(AssistiveArtifact)
            .where(
                AssistiveArtifact.document_id.in_(document_ids),
                AssistiveArtifact.artifact_type.in_(("document_extraction", "document_extraction_review")),
            )
            .order_by(AssistiveArtifact.created_at)
        )
    ).all()
    facts = (
        await session.scalars(
            select(ClinicalFact)
            .where(ClinicalFact.encounter_id == encounter_id, ClinicalFact.source_type == "document")
            .order_by(ClinicalFact.created_at)
        )
    ).all()
    timeline: list[DocumentTimelineItem] = []
    fact_page_numbers: dict[str, int] = {}
    for document in documents:
        timeline.append(
            DocumentTimelineItem(
                event_type="uploaded",
                occurred_at=document.created_at,
                document_id=document.id,
                data={
                    "document_type": document.document_type,
                    "original_filename": document.original_filename,
                    "mime_type": document.mime_type,
                    "processing_status": document.processing_status.value,
                },
            )
        )
    for artifact in artifacts:
        if artifact.artifact_type == "document_extraction_review":
            for promoted_fact in artifact.structured_data.get("promoted_facts", []):
                fact_id = promoted_fact.get("fact_id")
                page_number = promoted_fact.get("page_number")
                if isinstance(fact_id, str) and isinstance(page_number, int):
                    fact_page_numbers[fact_id] = page_number
        timeline.append(
            DocumentTimelineItem(
                event_type="review"
                if artifact.artifact_type == "document_extraction_review"
                else "extraction",
                occurred_at=artifact.created_at,
                document_id=artifact.document_id,
                artifact_id=artifact.id,
                data={
                    "provider": artifact.provider,
                    "status": artifact.status,
                    "structured_data": artifact.structured_data,
                },
            )
        )
    for fact in facts:
        if fact.source_id in document_ids:
            timeline.append(
                DocumentTimelineItem(
                    event_type="verified_fact",
                    occurred_at=fact.created_at,
                    document_id=fact.source_id,
                    page_number=fact_page_numbers.get(str(fact.id)),
                    data={
                        "fact_id": str(fact.id),
                        "fact_type": fact.fact_type,
                        "source_excerpt": fact.source_excerpt,
                        "verification_status": fact.verification_status.value,
                    },
                )
            )
    return sorted(timeline, key=lambda item: item.occurred_at)
