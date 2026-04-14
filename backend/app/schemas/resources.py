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


class ListingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    kleinanzeigen_id: str
    title: str
    price: str | None
    category: str | None
    image_url: str | None
    url: str | None
    view_count: int | None
    expires_at: datetime | None
    is_active: bool
    last_scraped_at: datetime


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
    last_scraped_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    conversation_id: int
    direction: str
    sender_name: str | None
    body: str
    sent_at: datetime | None
    is_read: bool


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
