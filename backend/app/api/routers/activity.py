from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models import User
from app.services.activity import get_activity_entries

router = APIRouter(prefix="/activity", tags=["activity"])


class ActivityOut(BaseModel):
    timestamp: datetime
    action: str
    user_id: int
    account_id: int | None = None
    listing_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


@router.get("", response_model=list[ActivityOut])
async def list_activity(
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
):
    return get_activity_entries(user_id=user.id, limit=limit)
