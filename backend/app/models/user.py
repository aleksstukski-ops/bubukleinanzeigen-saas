from datetime import datetime
from enum import Enum
from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class SubscriptionPlan(str, Enum):
    FREE = "free"
    STARTER = "starter"
    PRO = "pro"
    BUSINESS = "business"


PLAN_LIMITS = {
    SubscriptionPlan.FREE: 1,
    SubscriptionPlan.STARTER: 1,
    SubscriptionPlan.PRO: 3,
    SubscriptionPlan.BUSINESS: 10,
}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    plan: Mapped[str] = mapped_column(String(32), default=SubscriptionPlan.FREE.value)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), index=True)
    subscription_status: Mapped[str | None] = mapped_column(String(32))
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notify_push_new_message: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_email_new_message: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    kleinanzeigen_accounts: Mapped[list["KleinanzeigenAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    @property
    def account_limit(self) -> int:
        try:
            return PLAN_LIMITS[SubscriptionPlan(self.plan)]
        except ValueError:
            return PLAN_LIMITS[SubscriptionPlan.FREE]
