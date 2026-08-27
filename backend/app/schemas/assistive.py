from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import APIModel


class AssistiveArtifactResponse(APIModel):
    id: UUID
    encounter_id: UUID
    document_id: UUID | None
    artifact_type: str
    provider: str
    status: str
    language: str | None
    raw_text: str
    structured_data: dict
    confidence: float | None
    created_at: datetime


class DocumentExtractionRequest(APIModel):
    fixture_id: str = Field(default="printed_lab_report_v1", pattern="^[a-z0-9_]{3,64}$")
