from datetime import datetime
from enum import Enum
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class AccountStatus(str, Enum):
    PENDING_LOGIN = "pending_login"
    ACTIVE = "active"
    SESSION_EXPIRED = "session_expired"
    BANNED = "banned"
    DISABLED = "disabled"


class KleinanzeigenAccount(Base):
    __tablename__ = "kleinanzeigen_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(100))
    kleinanzeigen_user_name: Mapped[str | None] = mapped_column(String(255))
    kleinanzeigen_user_id: Mapped[str | None] = mapped_column(String(64), index=True)
    session_encrypted: Mapped[str | None] = mapped_column(Text)
    session_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default=AccountStatus.PENDING_LOGIN.value)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_scraped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="kleinanzeigen_accounts")
    listings: Mapped[list["Listing"]] = relationship(back_populates="account", cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship(back_populates="account", cascade="all, delete-orphan")
