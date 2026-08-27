from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.entities import SummaryStatus
from app.schemas.common import APIModel as BaseModel


class SummaryResponse(BaseModel):
    id: UUID
    encounter_id: UUID
    content: dict
    text: str
    source: str
    prompt_version: str | None
    status: SummaryStatus
    created_at: datetime


class SummaryUpdateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=15000)


class SummaryVerificationRequest(BaseModel):
    decision: str = Field(pattern="^(accept|reject)$")
