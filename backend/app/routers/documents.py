import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
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

router = APIRouter(tags=["documents"])
ALLOWED_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def safe_filename(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", Path(filename).name)[:200] or "upload"


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
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF, JPEG, and PNG files are accepted")
    settings = get_settings()
    content = await file.read(settings.max_upload_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Uploaded file is empty")
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File is too large")
    storage_key = f"{encounter_id}/{uuid4()}-{safe_filename(file.filename or 'upload')}"
    target = settings.upload_dir / storage_key
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
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
    await write_audit(
        session,
        "document.uploaded",
        actor_id=principal.subject if principal.token_type == "staff" else None,
        encounter_id=encounter_id,
        request=request,
        metadata={"document_type": document_type, "document_id": str(document.id)},
    )
    await session.commit()
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
