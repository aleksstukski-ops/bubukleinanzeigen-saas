from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class UserLoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    is_active: bool
    plan: str
    account_limit: int
    subscription_status: str | None
    subscription_expires_at: datetime | None
    created_at: datetime


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8)
