from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session

bearer_scheme = HTTPBearer(auto_error=False)


class Principal(BaseModel):
    subject: UUID | None = None
    role: str | None = None
    encounter_id: UUID | None = None
    token_type: str
    token_id: UUID
    token_expires_at: datetime


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(
    subject: UUID, role: str, token_type: str, expires_minutes: int, encounter_id: UUID | None = None
) -> str:
    settings = get_settings()
    expires_at = datetime.now(UTC) + timedelta(minutes=expires_minutes)
    payload = {
        "sub": str(subject),
        "role": role,
        "typ": token_type,
        "jti": str(uuid4()),
        "exp": expires_at,
    }
    if encounter_id:
        payload["encounter_id"] = str(encounter_id)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> Principal:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication is required")
    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        principal = Principal(
            subject=UUID(payload["sub"]),
            role=payload.get("role"),
            token_type=payload["typ"],
            encounter_id=UUID(payload["encounter_id"]) if payload.get("encounter_id") else None,
            token_id=UUID(payload["jti"]),
            token_expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC),
        )
        if principal.token_type == "staff":
            from app.models import RevokedToken, User

            is_revoked = await session.scalar(
                select(RevokedToken.id).where(RevokedToken.token_id == principal.token_id)
            )
            user = await session.get(User, principal.subject)
            if is_revoked or user is None or not user.active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is no longer active"
                )
        if principal.token_type == "patient":
            from app.models import PatientAccount, RevokedToken

            is_revoked = await session.scalar(
                select(RevokedToken.id).where(RevokedToken.token_id == principal.token_id)
            )
            account = await session.get(PatientAccount, principal.subject)
            if is_revoked or account is None or not account.active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="Token is no longer active"
                )
        return principal
    except (InvalidTokenError, ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from exc


def require_staff(*roles: str):
    async def dependency(principal: Principal = Depends(get_principal)) -> Principal:
        if principal.token_type != "staff" or principal.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permission")
        return principal

    return dependency


async def require_patient(principal: Principal = Depends(get_principal)) -> Principal:
    if principal.token_type != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patient account token required")
    return principal
