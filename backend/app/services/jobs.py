from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Job, JobStatus, JobType
from app.shared.queue import queue

# Job types where we deduplicate: skip if there is already a pending/running job
# of the same type for the same account. High-volume background jobs only.
_DEDUP_TYPES = {
    JobType.SCRAPE_LISTINGS.value,
    JobType.SCRAPE_MESSAGES.value,
    JobType.VERIFY_SESSION.value,
}


async def enqueue_job(
    db: AsyncSession,
    job_type: JobType | str,
    *,
    account_id: int | None = None,
    payload: dict[str, Any] | None = None,
    priority: int = 5,
    max_attempts: int = 3,
    deduplicate: bool = True,
) -> Job:
    """Insert a job into the DB and push it to Redis.

    When *deduplicate* is True and the job type is in _DEDUP_TYPES, the call
    returns the existing job without creating a duplicate if there is already a
    pending or running job of the same type for the same account.
    """
    type_str = job_type.value if isinstance(job_type, JobType) else job_type

    if deduplicate and type_str in _DEDUP_TYPES and account_id is not None:
        existing = await db.execute(
            select(Job).where(
                Job.type == type_str,
                Job.account_id == account_id,
                Job.status.in_([JobStatus.PENDING.value, JobStatus.RUNNING.value]),
            ).limit(1)
        )
        existing_job = existing.scalar_one_or_none()
        if existing_job is not None:
            return existing_job

    job = Job(
        type=type_str,
        status=JobStatus.PENDING.value,
        account_id=account_id,
        payload=payload or {},
        priority=priority,
        max_attempts=max_attempts,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    await queue.push(job.id, priority=priority)
    return job
