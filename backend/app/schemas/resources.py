from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class KleinanzeigenAccountCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100)


class KleinanzeigenAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    label: str
    kleinanzeigen_user_name: str | None
    status: str
    is_enabled: bool
    last_scraped_at: datetime | None
    last_error: str | None
    created_at: datetime
    listing_count: int = 0


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    kleinanzeigen_id: str
    title: str
    price: str | None
    price_type: str | None
    category: str | None
    description: str | None
    location: str | None
    image_url: str | None
    url: str | None
    view_count: int | None
    bookmark_count: int | None = 0
    expires_at: datetime | None
    is_active: bool
    bump_interval_days: int | None = None
    next_bump_at: datetime | None = None
    last_scraped_at: datetime
    created_at: datetime


class BumpScheduleIn(BaseModel):
    account_id: int
    bump_interval_days: int | None = Field(default=None, ge=1, le=30)


class ListingStatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    listing_id: int
    scraped_at: datetime
    view_count: int | None
    bookmark_count: int | None


class ListingUpdateIn(BaseModel):
    account_id: int
    title: str = Field(min_length=1, max_length=500)
    price: str | None = Field(default=None, max_length=64)
    description: str | None = Field(default=None, max_length=10000)


class ListingActionIn(BaseModel):
    account_id: int


class ListingListResponse(BaseModel):
    items: list[ListingOut]
    stale: bool
    last_updated: datetime | None


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    kleinanzeigen_id: str
    listing_kleinanzeigen_id: str | None
    partner_name: str | None
    subject: str | None
    last_message_preview: str | None
    last_message_at: datetime | None
    unread_count: int
    is_archived: bool
    last_scraped_at: datetime
    created_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    kleinanzeigen_id: str
    direction: str
    sender_name: str | None
    body: str
    sent_at: datetime | None
    is_read: bool
    created_at: datetime


class SendMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    status: str
    priority: int
    attempts: int
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
