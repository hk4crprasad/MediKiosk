from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.entities import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int


class CurrentUserResponse(BaseModel):
    id: UUID
    email: EmailStr
    role: UserRole


class StaffUserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)
    role: UserRole


class StaffUserResponse(BaseModel):
    id: UUID
    email: EmailStr
    role: UserRole
    active: bool
