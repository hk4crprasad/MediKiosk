import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import Principal, get_principal
from app.models import Document
from app.models.entities import DocumentStatus
from app.schemas.documents import DocumentResponse
from app.services.access import ensure_encounter_access, get_encounter_or_404
from app.services.audit import write_audit
from app.services.intake import ensure_active_consent
from app.services.storage import AzureBlobDocumentStorage

router = APIRouter(tags=["documents"])
ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def safe_filename(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)[:200] or "upload"


def has_expected_file_signature(content: bytes, mime_type: str) -> bool:
    signatures = {
        "application/pdf": b"%PDF-",
        "image/jpeg": b"\xff\xd8\xff",
        "image/png": b"\x89PNG\r\n\x1a\n",
    }
    return content.startswith(signatures[mime_type])


@router.post("/encounters/{encounter_id}/documents", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
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
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF, JPEG, and PNG files are accepted")
    if document_type not in {"prescription", "lab_report", "discharge_summary", "other"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported document type")
    settings = get_settings()
    content = await file.read(settings.max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Uploaded file is empty")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large")
    if not has_expected_file_signature(content, file.content_type):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="File content does not match its declared type")
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
    encounter_id: UUID, principal: Principal = Depends(get_principal), session: AsyncSession = Depends(get_session)
) -> list[DocumentResponse]:
    ensure_encounter_access(principal, encounter_id)
    documents = (
        await session.scalars(select(Document).where(Document.encounter_id == encounter_id).order_by(Document.created_at.desc()))
    ).all()
    return [DocumentResponse.model_validate(document) for document in documents]


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID, principal: Principal = Depends(get_principal), session: AsyncSession = Depends(get_session)
) -> DocumentResponse:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    ensure_encounter_access(principal, document.encounter_id)
    return DocumentResponse.model_validate(document)


@router.get("/documents/{document_id}/content", response_class=StreamingResponse)
async def download_document_content(
    document_id: UUID, principal: Principal = Depends(get_principal), session: AsyncSession = Depends(get_session)
) -> StreamingResponse:
    """Return the original source file only after encounter-scoped authorisation."""
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    ensure_encounter_access(principal, document.encounter_id)
    stream = await AzureBlobDocumentStorage(get_settings()).download(document.storage_key)
    headers = {"Content-Disposition": f'attachment; filename="{document.original_filename}"'}
    return StreamingResponse(stream, media_type=document.mime_type, headers=headers)
