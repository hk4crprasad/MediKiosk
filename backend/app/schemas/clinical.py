from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.entities import RedFlagSeverity


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


class ClinicianEncounterResponse(BaseModel):
    encounter: "EncounterResponse"
    facts: list["FactResponse"]
    red_flags: list[RedFlagResponse]
    documents: list["DocumentResponse"]
    summary: "SummaryResponse | None"


from app.schemas.documents import DocumentResponse  # noqa: E402
from app.schemas.encounters import EncounterResponse  # noqa: E402
from app.schemas.intake import FactResponse  # noqa: E402
from app.schemas.summaries import SummaryResponse  # noqa: E402

ClinicianEncounterResponse.model_rebuild()
