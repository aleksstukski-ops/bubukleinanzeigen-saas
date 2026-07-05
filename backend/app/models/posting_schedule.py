from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class PostingSchedule(Base):
    """Per-account auto-posting plan: N listings per day inside a time window."""

    __tablename__ = "posting_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"), unique=True, index=True,
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    posts_per_day: Mapped[int] = mapped_column(Integer, default=3)
    window_start_hour: Mapped[int] = mapped_column(Integer, default=9)
    window_end_hour: Mapped[int] = mapped_column(Integer, default=18)
    last_posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_today: Mapped[int] = mapped_column(Integer, default=0)
    posted_today_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )


class ScheduledListing(Base):
    """Draft queue for auto-posting: prepared listings waiting to be published."""

    __tablename__ = "scheduled_listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"), index=True,
    )
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[str | None] = mapped_column(String(64), nullable=True)
    category_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # queued -> posting -> posted | failed
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)
    job_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
