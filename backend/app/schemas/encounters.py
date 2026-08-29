from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.models.entities import EncounterStatus
from app.schemas.common import APIModel as BaseModel


class PatientInput(BaseModel):
    display_name: str | None = Field(default=None, max_length=200)
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    sex: str | None = Field(default=None, max_length=32)
    preferred_language: Literal["en", "hi"] = "en"
    abha_identifier: str | None = Field(default=None, max_length=64)
    respondent_type: Literal["patient", "caregiver"] = "patient"
    caregiver_relationship: str | None = Field(default=None, max_length=64)


class EncounterCreateRequest(BaseModel):
    patient: PatientInput
    mode: str = Field(default="kiosk", pattern="^(kiosk|assisted|demo)$")
    pathway_version: str = Field(default="chest-discomfort-v1", max_length=64)


class EncounterResponse(BaseModel):
    id: UUID
    patient_id: UUID
    status: EncounterStatus
    mode: str
    pathway_version: str
    version: int
    created_at: datetime
    submitted_at: datetime | None
    physician_verified_at: datetime | None


class EncounterCreatedResponse(BaseModel):
    encounter: EncounterResponse
    kiosk_session_token: str
    kiosk_token_expires_in_seconds: int


class ConsentCreateRequest(BaseModel):
    consent_type: str = Field(default="clinical_intake", max_length=64)
    version: str = Field(default="v1", max_length=64)
    language: Literal["en", "hi"] = "en"
    granted: bool


class ConsentResponse(BaseModel):
    id: UUID
    encounter_id: UUID
    consent_type: str
    version: str
    language: Literal["en", "hi"]
    granted: bool
    created_at: datetime
    revoked_at: datetime | None = None


class ConsentRevocationResponse(ConsentResponse):
    pass
