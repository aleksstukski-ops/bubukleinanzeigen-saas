from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AutoReplyRule(Base):
    """Auto-reply rule: when an incoming message body contains *trigger_text*,
    BubuBay enqueues a SEND_MESSAGE job with *reply_text*.

    Scope: when account_id is NULL the rule applies across all of the user's
    Kleinanzeigen accounts; otherwise it is scoped to that one account.
    """
    __tablename__ = "auto_reply_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[int | None] = mapped_column(
        ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    trigger_text: Mapped[str] = mapped_column(String(200))
    reply_text: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
