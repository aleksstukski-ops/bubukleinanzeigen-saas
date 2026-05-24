"""Category-watch CRUD — user-scoped.

CHECK_CATEGORY scraper job (registered in dispatcher) periodically
navigates to the saved search and compares results against
last_seen_listing_ids.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CategoryWatch, User
from app.schemas.resources import CategoryWatchIn, CategoryWatchOut

router = APIRouter(prefix="/watches", tags=["watches"])


async def _get_watch_for_user(db: AsyncSession, *, watch_id: int, user_id: int) -> CategoryWatch:
    result = await db.execute(
        select(CategoryWatch).where(
            CategoryWatch.id == watch_id,
            CategoryWatch.user_id == user_id,
        )
    )
    watch = result.scalar_one_or_none()
    if watch is None:
        raise HTTPException(status_code=404, detail="Watch not found")
    return watch


@router.get("", response_model=list[CategoryWatchOut])
async def list_watches(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CategoryWatch)
        .where(CategoryWatch.user_id == user.id)
        .order_by(CategoryWatch.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=CategoryWatchOut, status_code=201)
async def create_watch(
    payload: CategoryWatchIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    watch = CategoryWatch(
        user_id=user.id,
        search_query=payload.search_query,
        category=payload.category,
        notify_push=payload.notify_push,
        is_active=payload.is_active,
    )
    db.add(watch)
    await db.commit()
    await db.refresh(watch)
    return watch


@router.delete("/{watch_id}", status_code=204)
async def delete_watch(
    watch_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    watch = await _get_watch_for_user(db, watch_id=watch_id, user_id=user.id)
    await db.delete(watch)
    await db.commit()
    return None
