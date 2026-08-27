from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(APIModel):
    message: str


class AuditStamp(APIModel):
    id: UUID
    event_type: str
    created_at: datetime


class PaginatedResponse(APIModel):
    items: list[dict]
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)
