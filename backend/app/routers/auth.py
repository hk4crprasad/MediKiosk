from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.core.security import Principal, create_token, get_principal, hash_password, require_staff, verify_password
from app.models import RevokedToken, User
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    StaffUserCreateRequest,
    StaffUserResponse,
    TokenResponse,
)
from app.services.audit import write_audit

router = APIRouter(prefix="/auth", tags=["auth"])
admin_router = APIRouter(prefix="/admin", tags=["administration"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    user = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    settings = get_settings()
    token = create_token(user.id, user.role.value, "staff", settings.staff_token_expire_minutes)
    await write_audit(session, "staff.login", actor_id=user.id, request=request)
    await session.commit()
    return TokenResponse(access_token=token, expires_in_seconds=settings.staff_token_expire_minutes * 60)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    principal: Principal = Depends(get_principal),
    session: AsyncSession = Depends(get_session),
) -> None:
    if principal.token_type != "staff" or principal.subject is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff token required")
    revoked = await session.scalar(select(RevokedToken).where(RevokedToken.token_id == principal.token_id))
    if revoked is None:
        session.add(
            RevokedToken(
                token_id=principal.token_id,
                actor_id=principal.subject,
                expires_at=principal.token_expires_at,
            )
        )
    await write_audit(session, "staff.logout", actor_id=principal.subject, request=request)
    await session.commit()


@router.get("/me", response_model=CurrentUserResponse)
async def me(
    principal: Principal = Depends(get_principal), session: AsyncSession = Depends(get_session)
) -> CurrentUserResponse:
    if principal.token_type != "staff" or principal.subject is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff token required")
    user = await session.get(User, principal.subject)
    if user is None or not user.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is unavailable")
    return CurrentUserResponse.model_validate(user)


@admin_router.post("/users", response_model=StaffUserResponse, status_code=status.HTTP_201_CREATED)
async def create_staff_user(
    payload: StaffUserCreateRequest,
    request: Request,
    principal: Principal = Depends(require_staff("admin")),
    session: AsyncSession = Depends(get_session),
) -> StaffUserResponse:
    existing = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A staff user with this email already exists")
    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password), role=payload.role)
    session.add(user)
    await session.flush()
    await write_audit(
        session,
        "staff.user_created",
        actor_id=principal.subject,
        request=request,
        metadata={"created_user_id": str(user.id), "role": payload.role.value},
    )
    await session.commit()
    await session.refresh(user)
    return StaffUserResponse.model_validate(user)
