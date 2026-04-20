from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import JobType, KleinanzeigenAccount, Listing, User
from app.schemas.resources import (
    BumpScheduleIn,
    JobOut,
    ListingActionIn,
    ListingListResponse,
    ListingOut,
    ListingUpdateIn,
)
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/listings", tags=["listings"])
STALE_SECONDS = 120


async def _get_account_for_user(
    db: AsyncSession,
    *,
    account_id: int,
    user_id: int,
) -> KleinanzeigenAccount:
    acc_result = await db.execute(
        select(KleinanzeigenAccount).where(
            KleinanzeigenAccount.id == account_id,
            KleinanzeigenAccount.user_id == user_id,
        )
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def _get_listing_for_user(
    db: AsyncSession,
    *,
    kleinanzeigen_id: str,
    user_id: int,
) -> Listing:
    result = await db.execute(
        select(Listing)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Listing.account_id)
        .where(
            Listing.kleinanzeigen_id == kleinanzeigen_id,
            KleinanzeigenAccount.user_id == user_id,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@router.get("/all", response_model=list[ListingOut])
async def list_all_listings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all active listings for all accounts belonging to this user — single DB query."""
    result = await db.execute(
        select(Listing)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Listing.account_id)
        .where(
            KleinanzeigenAccount.user_id == user.id,
            Listing.is_active.is_(True),
        )
        .order_by(Listing.last_scraped_at.desc())
    )
    return result.scalars().all()


@router.get("", response_model=ListingListResponse)
async def list_listings(
    account_id: int = Query(..., description="Kleinanzeigen account id"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=account_id, user_id=user.id)

    result = await db.execute(
        select(Listing)
        .where(Listing.account_id == account_id, Listing.is_active.is_(True))
        .order_by(Listing.last_scraped_at.desc())
    )
    listings = result.scalars().all()

    last_updated = max((listing.last_scraped_at for listing in listings), default=None)
    is_stale = True

    if last_updated is not None:
        age = (datetime.now(timezone.utc) - last_updated).total_seconds()
        is_stale = age > STALE_SECONDS

    if is_stale and account.status == "active":
        await enqueue_job(db, JobType.SCRAPE_LISTINGS, account_id=account.id, priority=5)

    return ListingListResponse(items=listings, stale=is_stale, last_updated=last_updated)


@router.post("/{listing_id}/bump", response_model=JobOut)
async def bump_listing(
    listing_id: str,
    payload: ListingActionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    job = await enqueue_job(
        db,
        JobType.BUMP_LISTING,
        account_id=account.id,
        payload={"listing_id": listing.kleinanzeigen_id},
        priority=2,
    )
    return job


@router.patch("/{listing_id}", response_model=JobOut)
async def update_listing(
    listing_id: str,
    payload: ListingUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    job = await enqueue_job(
        db,
        JobType.UPDATE_LISTING,
        account_id=account.id,
        payload={
            "listing_id": listing.kleinanzeigen_id,
            "title": payload.title,
            "price": payload.price,
            "description": payload.description,
        },
        priority=3,
    )
    return job


@router.patch("/{listing_id}/bump-schedule", response_model=ListingOut)
async def set_bump_schedule(
    listing_id: str,
    payload: BumpScheduleIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or clear the auto-bump schedule for a listing."""
    from datetime import timedelta
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    listing.bump_interval_days = payload.bump_interval_days
    if payload.bump_interval_days is not None:
        listing.next_bump_at = datetime.now(timezone.utc) + timedelta(days=payload.bump_interval_days)
    else:
        listing.next_bump_at = None

    await db.commit()
    await db.refresh(listing)
    return listing


@router.delete("/{listing_id}", response_model=JobOut)
async def delete_listing(
    listing_id: str,
    payload: ListingActionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    job = await enqueue_job(
        db,
        JobType.DELETE_LISTING,
        account_id=account.id,
        payload={"listing_id": listing.kleinanzeigen_id},
        priority=3,
    )
    return job
