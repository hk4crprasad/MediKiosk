from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.entities import DocumentStatus


class DocumentResponse(BaseModel):
    id: UUID
    encounter_id: UUID
    document_type: str
    original_filename: str
    mime_type: str
    size_bytes: int
    processing_status: DocumentStatus
    created_at: datetime
