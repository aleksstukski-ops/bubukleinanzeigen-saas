"""Admin dashboard endpoints — requires is_admin=True."""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models import Job, JobStatus, KleinanzeigenAccount, User

log = logging.getLogger("api.admin")
router = APIRouter(prefix="/admin", tags=["admin"])


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str | None
    plan: str
    subscription_status: str | None
    is_active: bool
    is_admin: bool
    account_count: int
    created_at: datetime


class AdminStatsOut(BaseModel):
    total_users: int
    active_subscriptions: int
    total_accounts: int
    active_accounts: int
    jobs_last_24h: int
    jobs_failed_last_24h: int
    jobs_pending: int


class AdminJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int | None
    type: str
    status: str
    attempts: int
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class AdminAccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    label: str
    kleinanzeigen_user_name: str | None
    status: str
    last_scraped_at: datetime | None
    last_error: str | None
    created_at: datetime


@router.get("/stats", response_model=AdminStatsOut)
async def get_stats(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)

    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    active_subs = (await db.execute(
        select(func.count(User.id)).where(User.subscription_status == "active")
    )).scalar_one()
    total_accounts = (await db.execute(select(func.count(KleinanzeigenAccount.id)))).scalar_one()
    active_accounts = (await db.execute(
        select(func.count(KleinanzeigenAccount.id)).where(KleinanzeigenAccount.status == "active")
    )).scalar_one()
    jobs_24h = (await db.execute(
        select(func.count(Job.id)).where(Job.created_at >= since_24h)
    )).scalar_one()
    jobs_failed_24h = (await db.execute(
        select(func.count(Job.id)).where(Job.created_at >= since_24h, Job.status == JobStatus.FAILED.value)
    )).scalar_one()
    jobs_pending = (await db.execute(
        select(func.count(Job.id)).where(Job.status.in_([JobStatus.PENDING.value, JobStatus.RUNNING.value, JobStatus.RETRYING.value]))
    )).scalar_one()

    return AdminStatsOut(
        total_users=total_users,
        active_subscriptions=active_subs,
        total_accounts=total_accounts,
        active_accounts=active_accounts,
        jobs_last_24h=jobs_24h,
        jobs_failed_last_24h=jobs_failed_24h,
        jobs_pending=jobs_pending,
    )


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(desc(User.created_at)))
    users = result.scalars().all()

    # Get account counts per user
    counts_result = await db.execute(
        select(KleinanzeigenAccount.user_id, func.count(KleinanzeigenAccount.id))
        .group_by(KleinanzeigenAccount.user_id)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}

    out = []
    for user in users:
        out.append(AdminUserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            plan=user.plan,
            subscription_status=user.subscription_status,
            is_active=user.is_active,
            is_admin=user.is_admin,
            account_count=counts.get(user.id, 0),
            created_at=user.created_at,
        ))
    return out


@router.get("/jobs", response_model=list[AdminJobOut])
async def list_jobs(
    limit: int = 50,
    status: str | None = None,
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Job).order_by(desc(Job.created_at)).limit(min(limit, 200))
    if status:
        query = query.where(Job.status == status)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/accounts", response_model=list[AdminAccountOut])
async def list_accounts(
    _admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KleinanzeigenAccount).order_by(desc(KleinanzeigenAccount.last_scraped_at)))
    return result.scalars().all()
