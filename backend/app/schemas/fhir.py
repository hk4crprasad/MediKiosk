from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FhirExportResponse(BaseModel):
    id: UUID
    encounter_id: UUID
    validation_status: str
    bundle: dict
    created_at: datetime
