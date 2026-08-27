from datetime import datetime
from typing import Literal
from uuid import UUID

from app.models.entities import DocumentStatus
from app.schemas.common import APIModel as BaseModel


class DocumentResponse(BaseModel):
    id: UUID
    encounter_id: UUID
    document_type: str
    original_filename: str
    mime_type: str
    size_bytes: int
    processing_status: DocumentStatus
    created_at: datetime


class DocumentTimelineItem(BaseModel):
    event_type: Literal["uploaded", "extraction", "review", "verified_fact"]
    occurred_at: datetime
    document_id: UUID
    artifact_id: UUID | None = None
    page_number: int | None = None
    data: dict
