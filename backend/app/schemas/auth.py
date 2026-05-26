from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _validate_password_strength(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not any(char.isdigit() for char in value):
        raise ValueError("Password must contain at least one number")
    return value


class UserRegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)


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
    notify_push_new_message: bool = True
    notify_email_new_message: bool = False
    created_at: datetime


class NotificationSettingsIn(BaseModel):
    notify_push_new_message: bool
    notify_email_new_message: bool


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_strength(value)
