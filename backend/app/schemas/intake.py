from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.models.entities import EncounterStatus, VerificationStatus
from app.schemas.common import APIModel as BaseModel


class QuestionResponse(BaseModel):
    key: str
    section: str
    prompt: str
    input_type: Literal["single_choice"]
    required: bool
    choices: list[str] = []
    choice_labels: dict[str, str] = Field(default_factory=dict)
    pathway_version: str


class IntakeResponseCreateRequest(BaseModel):
    question_key: str = Field(min_length=1, max_length=128)
    value: str = Field(min_length=1, max_length=128)
    raw_text: str | None = Field(default=None, max_length=2000)
    input_mode: str = Field(default="touch", pattern="^(touch|voice|caregiver|staff)$")
    language: str = Field(default="en", min_length=2, max_length=16)


class FactResponse(BaseModel):
    id: UUID
    fact_type: str
    value: dict
    source_type: str
    source_id: UUID | None
    source_excerpt: str | None
    confidence: float | None
    verification_status: VerificationStatus
    created_at: datetime
    display_label: str | None = None
    display_value: str | None = None


class IntakeResponseResult(BaseModel):
    response_id: UUID
    encounter_status: EncounterStatus
    created_facts: list[FactResponse]
    active_red_flag_ids: list[UUID]


class SubmitResponse(BaseModel):
    encounter: "EncounterResponse"
    missing_question_keys: list[str]


from app.schemas.encounters import EncounterResponse  # noqa: E402

SubmitResponse.model_rebuild()
