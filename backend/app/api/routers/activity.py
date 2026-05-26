from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services.cache import ACTIVITY_TTL_SECONDS, activity_cache_key, get_cache_json, set_cache_json
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
    db: AsyncSession = Depends(get_db),
):
    cache_key = activity_cache_key(user.id, limit)
    cached = await get_cache_json(cache_key)
    if cached is not None:
        return cached

    entries = await get_activity_entries(db, user_id=user.id, limit=limit)
    await set_cache_json(cache_key, entries, ACTIVITY_TTL_SECONDS)
    return entries
