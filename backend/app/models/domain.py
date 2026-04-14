from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        UniqueConstraint("account_id", "kleinanzeigen_id", name="uq_listing_ka_id"),
        Index("ix_listings_account_active", "account_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"), index=True)
    kleinanzeigen_id: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(500))
    price: Mapped[str | None] = mapped_column(String(64))
    price_type: Mapped[str | None] = mapped_column(String(32))
    category: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    image_url: Mapped[str | None] = mapped_column(String(1000))
    url: Mapped[str | None] = mapped_column(String(1000))
    view_count: Mapped[int | None] = mapped_column(Integer)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account: Mapped["KleinanzeigenAccount"] = relationship(back_populates="listings")


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (
        UniqueConstraint("account_id", "kleinanzeigen_id", name="uq_conv_ka_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"), index=True)
    kleinanzeigen_id: Mapped[str] = mapped_column(String(64), index=True)
    listing_kleinanzeigen_id: Mapped[str | None] = mapped_column(String(32), index=True)
    partner_name: Mapped[str | None] = mapped_column(String(255))
    subject: Mapped[str | None] = mapped_column(String(500))
    last_message_preview: Mapped[str | None] = mapped_column(String(500))
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    unread_count: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    last_scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account: Mapped["KleinanzeigenAccount"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.sent_at",
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint("conversation_id", "kleinanzeigen_id", name="uq_msg_ka_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), index=True)
    kleinanzeigen_id: Mapped[str] = mapped_column(String(64))
    direction: Mapped[str] = mapped_column(String(16))
    sender_name: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
