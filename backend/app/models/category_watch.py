from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class CategoryWatch(Base):
    """User-defined watch on a Kleinanzeigen search.

    The scraper periodically navigates to the search URL, snapshots the result
    list, and compares it to last_seen_listing_ids. Newly appeared items
    trigger a push (and/or other channels later).
    """
    __tablename__ = "category_watches"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    search_query: Mapped[str] = mapped_column(String(200))
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    notify_push: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_seen_listing_ids: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
