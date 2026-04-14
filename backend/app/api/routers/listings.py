from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import JobType, KleinanzeigenAccount, Listing, User
from app.schemas.resources import ListingListResponse
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/listings", tags=["listings"])
STALE_SECONDS = 120


@router.get("", response_model=ListingListResponse)
async def list_listings(
    account_id: int = Query(..., description="Kleinanzeigen account id"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    acc_result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    result = await db.execute(
        select(Listing).where(Listing.account_id == account_id, Listing.is_active.is_(True)).order_by(Listing.last_scraped_at.desc())
    )
    listings = result.scalars().all()
    last_updated = max((l.last_scraped_at for l in listings), default=None)
    is_stale = True
    if last_updated is not None:
        age = (datetime.now(timezone.utc) - last_updated).total_seconds()
        is_stale = age > STALE_SECONDS
    if is_stale and account.status == "active":
        await enqueue_job(db, JobType.SCRAPE_LISTINGS, account_id=account.id, priority=5)
    return ListingListResponse(items=listings, stale=is_stale, last_updated=last_updated)
