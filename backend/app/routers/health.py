from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness endpoint. It deliberately avoids database and provider calls."""
    return {"status": "ok"}


@router.get("/ready")
async def ready(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    """Readiness endpoint. It checks only the database connection."""
    await session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
