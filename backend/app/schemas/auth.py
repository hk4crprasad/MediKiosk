from uuid import UUID

from pydantic import Field

from app.models.entities import UserRole
from app.schemas.common import APIModel as BaseModel


class LoginRequest(BaseModel):
    # Deliberately permits a .local address for the documented offline/demo bootstrap account.
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int


class CurrentUserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole


class StaffUserCreateRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=12, max_length=256)
    role: UserRole


class StaffUserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    active: bool
