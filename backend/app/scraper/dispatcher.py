import logging
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Job, JobType
from app.scraper.session_manager import SessionManager

log = logging.getLogger("scraper.dispatcher")


class JobError(Exception):
    def __init__(self, message: str, *, recoverable: bool = True):
        super().__init__(message)
        self.recoverable = recoverable


async def _not_implemented(job, *_):
    raise JobError(f"Handler for {job.type} not yet implemented (Session 2+)", recoverable=False)


HANDLERS = {
    JobType.SCRAPE_LISTINGS.value: _not_implemented,
    JobType.SCRAPE_MESSAGES.value: _not_implemented,
    JobType.SCRAPE_CONVERSATION.value: _not_implemented,
    JobType.SEND_MESSAGE.value: _not_implemented,
    JobType.CREATE_LISTING.value: _not_implemented,
    JobType.UPDATE_LISTING.value: _not_implemented,
    JobType.DELETE_LISTING.value: _not_implemented,
    JobType.BUMP_LISTING.value: _not_implemented,
    JobType.VERIFY_SESSION.value: _not_implemented,
}


async def dispatch_job(job: Job, db: AsyncSession, session_manager: SessionManager) -> dict[str, Any] | None:
    handler = HANDLERS.get(job.type)
    if handler is None:
        raise JobError(f"Unknown job type: {job.type}", recoverable=False)
    log.info("Dispatching job %s (type=%s, attempt=%s)", job.id, job.type, job.attempts)
    return await handler(job, db, session_manager)
