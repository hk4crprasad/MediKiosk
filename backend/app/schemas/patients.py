from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from app.models.entities import DocumentStatus
from app.schemas.common import APIModel as BaseModel

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class PatientRegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=8, max_length=256)
    display_name: str | None = Field(default=None, max_length=200)
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    sex: str | None = Field(default=None, max_length=32)
    abha_identifier: str | None = Field(default=None, max_length=64)


class PatientLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=1, max_length=256)


class PatientTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int


class PatientAccountResponse(BaseModel):
    id: UUID
    email: str
    display_name: str | None
    birth_year: int | None
    sex: str | None
    abha_identifier: str | None
    active: bool
    created_at: datetime


class PatientRecordCreateRequest(BaseModel):
    """Multipart form fields alongside the uploaded file (see routers/patients.py)."""

    document_type: str = Field(default="other", max_length=64)
    visit_date: date | None = None
    hospital_or_clinic: str | None = Field(default=None, max_length=200)
    visit_reason: str | None = Field(default=None, max_length=500)


class PatientRecordResponse(BaseModel):
    id: UUID
    patient_account_id: UUID
    document_type: str
    visit_date: date | None
    hospital_or_clinic: str | None
    visit_reason: str | None
    original_filename: str
    mime_type: str
    size_bytes: int
    processing_status: DocumentStatus
    created_at: datetime


class PatientRecordExtractionResponse(BaseModel):
    id: UUID
    patient_record_id: UUID
    provider: str
    status: str
    raw_text: str
    structured_data: dict
    confidence: float | None
    created_at: datetime


class PatientHistorySummaryResponse(BaseModel):
    id: UUID
    patient_account_id: UUID
    content: dict
    text: str
    source: str
    prompt_version: str | None
    prompt_metadata: dict
    created_at: datetime


class StaffPatientSearchResult(BaseModel):
    id: UUID
    email: str
    display_name: str | None
    abha_identifier: str | None
    record_count: int
    last_activity_at: datetime | None


class StaffPatientProfileResponse(BaseModel):
    account: PatientAccountResponse
    records: list[PatientRecordResponse]
    summary: PatientHistorySummaryResponse | None
