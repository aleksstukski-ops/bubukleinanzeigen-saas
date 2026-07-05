from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (
    AccountStatus,
    Conversation,
    JobType,
    KleinanzeigenAccount,
    Listing,
    ScheduledListing,
    User,
)
from app.schemas.resources import JobOut, KleinanzeigenAccountCreate, KleinanzeigenAccountOut
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/ka-accounts", tags=["kleinanzeigen-accounts"])


@router.get("/health-summary")
async def health_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight roll-up for the layout-level banner.

    Returns counts of accounts that need user attention (session expired
    or pending login) plus a short list of their labels so the banner
    can name them. Designed to be cheap enough for 15 s polling.
    """
    result = await db.execute(
        select(KleinanzeigenAccount.id, KleinanzeigenAccount.label, KleinanzeigenAccount.status)
        .where(KleinanzeigenAccount.user_id == user.id)
        .where(KleinanzeigenAccount.status.in_([
            AccountStatus.SESSION_EXPIRED.value,
            AccountStatus.PENDING_LOGIN.value,
        ]))
        .order_by(KleinanzeigenAccount.created_at)
    )
    rows = result.all()
    needs_login = [
        {"id": row.id, "label": row.label, "status": row.status}
        for row in rows
    ]
    return {
        "needs_login_count": len(needs_login),
        "needs_login": needs_login,
    }


@router.get("/overview")
async def accounts_overview(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One call for the dashboard: every account with listings, views,
    unread messages and auto-post queue length. All aggregates are batched
    (4 GROUP-BY queries total, independent of account count)."""
    accounts_result = await db.execute(
        select(KleinanzeigenAccount)
        .where(KleinanzeigenAccount.user_id == user.id)
        .order_by(KleinanzeigenAccount.created_at)
    )
    accounts = accounts_result.scalars().all()
    account_ids = [a.id for a in accounts]

    listing_stats: dict[int, tuple[int, int, int]] = {}
    unread: dict[int, int] = {}
    queued: dict[int, int] = {}
    if account_ids:
        listing_result = await db.execute(
            select(
                Listing.account_id,
                func.count(Listing.id),
                func.coalesce(func.sum(Listing.view_count), 0),
                func.coalesce(func.sum(Listing.bookmark_count), 0),
            )
            .where(Listing.account_id.in_(account_ids), Listing.is_active.is_(True))
            .group_by(Listing.account_id)
        )
        listing_stats = {row[0]: (row[1], int(row[2]), int(row[3])) for row in listing_result.all()}

        unread_result = await db.execute(
            select(Conversation.account_id, func.coalesce(func.sum(Conversation.unread_count), 0))
            .where(Conversation.account_id.in_(account_ids))
            .group_by(Conversation.account_id)
        )
        unread = {row[0]: int(row[1]) for row in unread_result.all()}

        queued_result = await db.execute(
            select(ScheduledListing.account_id, func.count(ScheduledListing.id))
            .where(
                ScheduledListing.account_id.in_(account_ids),
                ScheduledListing.status == "queued",
            )
            .group_by(ScheduledListing.account_id)
        )
        queued = {row[0]: row[1] for row in queued_result.all()}

    out = []
    for account in accounts:
        count, views, bookmarks = listing_stats.get(account.id, (0, 0, 0))
        out.append({
            "id": account.id,
            "label": account.label,
            "kleinanzeigen_user_name": account.kleinanzeigen_user_name,
            "status": account.status,
            "is_enabled": account.is_enabled,
            "last_scraped_at": account.last_scraped_at,
            "last_error": account.last_error,
            "listing_count": count,
            "total_views": views,
            "total_bookmarks": bookmarks,
            "unread_count": unread.get(account.id, 0),
            "queued_posts": queued.get(account.id, 0),
        })
    return {"accounts": out}


@router.get("", response_model=list[KleinanzeigenAccountOut])
async def list_accounts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    accounts_result = await db.execute(
        select(KleinanzeigenAccount)
        .where(KleinanzeigenAccount.user_id == user.id)
        .order_by(KleinanzeigenAccount.created_at)
    )
    accounts = accounts_result.scalars().all()

    # Batch listing counts in one query
    account_ids = [a.id for a in accounts]
    counts: dict[int, int] = {}
    if account_ids:
        counts_result = await db.execute(
            select(Listing.account_id, func.count(Listing.id))
            .where(Listing.account_id.in_(account_ids), Listing.is_active.is_(True))
            .group_by(Listing.account_id)
        )
        counts = {row[0]: row[1] for row in counts_result.all()}

    out = []
    for account in accounts:
        data = {
            "id": account.id,
            "label": account.label,
            "kleinanzeigen_user_name": account.kleinanzeigen_user_name,
            "status": account.status,
            "is_enabled": account.is_enabled,
            "last_scraped_at": account.last_scraped_at,
            "last_error": account.last_error,
            "created_at": account.created_at,
            "listing_count": counts.get(account.id, 0),
        }
        out.append(KleinanzeigenAccountOut(**data))
    return out


@router.post("", response_model=KleinanzeigenAccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(data: KleinanzeigenAccountCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count_result = await db.execute(select(func.count(KleinanzeigenAccount.id)).where(KleinanzeigenAccount.user_id == user.id))
    current_count = count_result.scalar_one()
    if current_count >= user.account_limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Account limit reached for plan '{user.plan}' ({current_count}/{user.account_limit}). Upgrade to add more.",
        )
    account = KleinanzeigenAccount(user_id=user.id, label=data.label, status=AccountStatus.PENDING_LOGIN.value)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    await db.delete(account)
    await db.commit()


@router.post("/{account_id}/start-login", response_model=JobOut)
async def start_login(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if not account.is_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account disabled")

    job = await enqueue_job(
        db,
        JobType.START_LOGIN,
        account_id=account.id,
        payload={"account_id": account.id},
        priority=1,
        max_attempts=1,
    )
    return job


@router.post("/{account_id}/refresh", response_model=JobOut)
async def trigger_refresh(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.status != AccountStatus.ACTIVE.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Account not active (status: {account.status})")
    job = await enqueue_job(
        db,
        JobType.SCRAPE_LISTINGS,
        account_id=account.id,
        payload={"account_id": account.id},
        priority=3,
    )
    await enqueue_job(db, JobType.SCRAPE_MESSAGES, account_id=account.id, priority=3)
    return job


@router.post("/{account_id}/verify", response_model=JobOut)
async def verify_session(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    job = await enqueue_job(
        db,
        JobType.VERIFY_SESSION,
        account_id=account.id,
        payload={"account_id": account.id},
        priority=2,
    )
    return job
