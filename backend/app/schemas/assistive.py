from datetime import datetime
from typing import Literal
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


class DocumentFactPromotion(APIModel):
    fact_type: str = Field(min_length=1, max_length=128, pattern="^[a-z][a-z0-9_]*$")
    value: dict = Field(default_factory=dict)
    source_excerpt: str = Field(min_length=1, max_length=4000)
    page_number: int = Field(ge=1, le=1000)


class DocumentExtractionReviewRequest(APIModel):
    decision: Literal["accepted", "corrected", "rejected"]
    note: str | None = Field(default=None, max_length=2000)
    promoted_facts: list[DocumentFactPromotion] = Field(default_factory=list, max_length=50)


class DocumentExtractionReviewResponse(APIModel):
    review: AssistiveArtifactResponse
    promoted_fact_ids: list[UUID]
