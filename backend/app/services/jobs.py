from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Job, JobStatus, JobType
from app.shared.queue import queue


async def enqueue_job(
    db: AsyncSession,
    job_type: JobType | str,
    *,
    account_id: int | None = None,
    payload: dict[str, Any] | None = None,
    priority: int = 5,
    max_attempts: int = 3,
) -> Job:
    job = Job(
        type=job_type.value if isinstance(job_type, JobType) else job_type,
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
