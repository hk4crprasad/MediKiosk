from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import Principal
from app.models import Encounter


async def get_encounter_or_404(session: AsyncSession, encounter_id: UUID) -> Encounter:
    encounter = await session.scalar(select(Encounter).where(Encounter.id == encounter_id))
    if encounter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")
    return encounter


def ensure_encounter_access(principal: Principal, encounter_id: UUID, *, staff_roles: tuple[str, ...] = ()) -> None:
    if principal.token_type == "kiosk" and principal.encounter_id == encounter_id:
        return
    if principal.token_type == "staff" and (not staff_roles or principal.role in staff_roles):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access this encounter")
