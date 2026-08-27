from datetime import datetime
from uuid import UUID

from app.schemas.common import APIModel as BaseModel

class FhirExportResponse(BaseModel):
    id: UUID
    encounter_id: UUID
    validation_status: str
    bundle: dict
    created_at: datetime
