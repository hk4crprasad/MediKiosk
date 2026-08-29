from datetime import datetime
from uuid import UUID

from app.models.entities import RedFlagSeverity
from app.schemas.common import APIModel as BaseModel


class RedFlagResponse(BaseModel):
    id: UUID
    encounter_id: UUID
    rule_id: str
    rule_version: str
    severity: RedFlagSeverity
    reason: str
    evidence_fact_ids: list[UUID]
    active: bool
    acknowledged_by: UUID | None
    acknowledged_at: datetime | None
    created_at: datetime


class AcknowledgeRequest(BaseModel):
    note: str | None = None


class TriageQueueItem(BaseModel):
    encounter_id: UUID
    encounter_status: str
    patient_display_name: str | None
    red_flag: RedFlagResponse


class EncounterListItem(BaseModel):
    encounter_id: UUID
    encounter_status: str
    pathway_version: str
    patient_display_name: str | None
    patient_birth_year: int | None
    patient_sex: str | None
    patient_abha_identifier: str | None = None
    patient_respondent_type: str | None = None
    patient_caregiver_relationship: str | None = None
    has_active_red_flag: bool
    created_at: datetime
    submitted_at: datetime | None


class ClinicianEncounterResponse(BaseModel):
    encounter: "EncounterResponse"
    patient: "PatientInput | None" = None
    facts: list["FactResponse"]
    red_flags: list[RedFlagResponse]
    documents: list["DocumentResponse"]
    summary: "SummaryResponse | None"


from app.schemas.documents import DocumentResponse  # noqa: E402
from app.schemas.encounters import EncounterResponse, PatientInput  # noqa: E402
from app.schemas.intake import FactResponse  # noqa: E402
from app.schemas.summaries import SummaryResponse  # noqa: E402

ClinicianEncounterResponse.model_rebuild()
