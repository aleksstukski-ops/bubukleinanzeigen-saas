"""Job status endpoints — frontend polls these while jobs are running."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Job, KleinanzeigenAccount, User
from app.schemas.resources import JobOut

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Ensure this job belongs to one of the user's accounts (or has no account)
    result = await db.execute(
        select(Job)
        .outerjoin(
            KleinanzeigenAccount, Job.account_id == KleinanzeigenAccount.id
        )
        .where(Job.id == job_id)
        .where(
            (Job.account_id.is_(None))
            | (KleinanzeigenAccount.user_id == user.id)
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("", response_model=list[JobOut])
async def list_recent_jobs(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recent jobs across all of the user's accounts."""
    limit = max(1, min(limit, 200))
    result = await db.execute(
        select(Job)
        .join(KleinanzeigenAccount, Job.account_id == KleinanzeigenAccount.id)
        .where(KleinanzeigenAccount.user_id == user.id)
        .order_by(Job.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
