from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent


async def write_audit(
    session: AsyncSession,
    event_type: str,
    *,
    actor_id: UUID | None = None,
    encounter_id: UUID | None = None,
    request: Request | None = None,
    metadata: dict | None = None,
) -> AuditEvent:
    event = AuditEvent(
        actor_id=actor_id,
        encounter_id=encounter_id,
        event_type=event_type,
        request_id=getattr(request.state, "request_id", None) if request else None,
        metadata_json=metadata or {},
    )
    session.add(event)
    return event
