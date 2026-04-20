import asyncio
import logging
import signal
from datetime import datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy import and_, select
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models import Job, JobStatus, JobType
from app.models.domain import Listing
from app.scraper.dispatcher import dispatch_job, JobError
from app.scraper.session_manager import SessionManager
from app.services.alerts import send_alert
from app.services.jobs import enqueue_job
from app.shared.queue import queue

log = logging.getLogger("scraper.worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


class Worker:
    def __init__(self):
        self.session_manager = SessionManager()
        self.semaphore = asyncio.Semaphore(settings.SCRAPER_MAX_CONCURRENT_ACCOUNTS)
        self._shutdown = asyncio.Event()
        self._tasks = set()

    async def run(self) -> None:
        log.info("Scraper worker started (max concurrent accounts=%s)", settings.SCRAPER_MAX_CONCURRENT_ACCOUNTS)
        Path(settings.SCRAPER_SESSION_DIR).mkdir(parents=True, exist_ok=True)
        # Start auto-bump scheduler as a background task
        scheduler_task = asyncio.create_task(self._bump_scheduler_loop())
        self._tasks.add(scheduler_task)
        scheduler_task.add_done_callback(self._tasks.discard)
        try:
            while not self._shutdown.is_set():
                item = await queue.pop(timeout=3)
                if item is None:
                    continue
                job_id = item.get("job_id")
                if not job_id:
                    continue
                task = asyncio.create_task(self._handle(job_id))
                self._tasks.add(task)
                task.add_done_callback(self._tasks.discard)
        finally:
            log.info("Shutting down — waiting for %s tasks", len(self._tasks))
            if self._tasks:
                await asyncio.gather(*self._tasks, return_exceptions=True)
            await self.session_manager.close_all()
            await queue.close()
            log.info("Worker shutdown complete")

    async def _bump_scheduler_loop(self) -> None:
        """Check every 5 minutes for listings with due auto-bumps and enqueue jobs."""
        INTERVAL = 300  # 5 minutes
        while not self._shutdown.is_set():
            try:
                await self._schedule_due_bumps()
            except Exception:
                log.exception("Error in bump scheduler loop")
            # Wait in small slices so shutdown is responsive
            for _ in range(INTERVAL):
                if self._shutdown.is_set():
                    return
                await asyncio.sleep(1)

    async def _schedule_due_bumps(self) -> None:
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Listing).where(
                    and_(
                        Listing.next_bump_at.isnot(None),
                        Listing.next_bump_at <= now,
                        Listing.is_active.is_(True),
                    )
                )
            )
            listings = result.scalars().all()
            if not listings:
                return
            log.info("Auto-bump scheduler: %s listing(s) due for bump", len(listings))
            for listing in listings:
                await enqueue_job(
                    db,
                    JobType.BUMP_LISTING,
                    account_id=listing.account_id,
                    payload={"listing_id": listing.kleinanzeigen_id, "auto_bump": True},
                    priority=4,
                )
                # Advance next_bump_at immediately to prevent duplicate scheduling
                if listing.bump_interval_days:
                    listing.next_bump_at = now + timedelta(days=listing.bump_interval_days)
                else:
                    listing.next_bump_at = None
                db.add(listing)
            await db.commit()
            log.info("Auto-bump scheduler: enqueued %s bump job(s)", len(listings))

    async def _handle(self, job_id: int) -> None:
        async with self.semaphore:
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Job).where(Job.id == job_id))
                job = result.scalar_one_or_none()
                if job is None:
                    log.warning("Job %s not found in DB, skipping", job_id)
                    return
                job.status = JobStatus.RUNNING.value
                job.started_at = datetime.now(timezone.utc)
                job.attempts += 1
                await db.commit()
                try:
                    output = await dispatch_job(job, db, self.session_manager)
                    job.status = JobStatus.SUCCESS.value
                    job.result = output or {}
                    job.error_message = None
                except JobError as e:
                    await self._on_failure(db, job, e, recoverable=e.recoverable)
                except Exception as e:
                    log.exception("Unhandled error in job %s", job_id)
                    await self._on_failure(db, job, e, recoverable=True)
                finally:
                    job.finished_at = datetime.now(timezone.utc)
                    await db.commit()

    async def _on_failure(self, db, job: Job, exc: Exception, *, recoverable: bool):
        job.error_message = f"{type(exc).__name__}: {exc}"[:2000]
        try:
            if job.account_id is not None:
                path = await self.session_manager.capture_debug_snapshot(job.account_id, job.id)
                if path:
                    job.screenshot_path = path
        except Exception:
            log.exception("Failed to capture debug snapshot for job %s", job.id)
        if recoverable and job.attempts < job.max_attempts:
            job.status = JobStatus.RETRYING.value
            await queue.push(job.id, priority=max(job.priority, 4))
            log.warning("Job %s failed (%s), retry %s/%s", job.id, job.error_message, job.attempts, job.max_attempts)
        else:
            job.status = JobStatus.FAILED.value
            log.error("Job %s permanently failed: %s", job.id, job.error_message)
            asyncio.create_task(send_alert(
                subject=f"[BubuKA] Job {job.id} permanently failed",
                body=(
                    f"Job ID: {job.id}\n"
                    f"Type:   {job.type}\n"
                    f"Account: {job.account_id}\n"
                    f"Attempts: {job.attempts}/{job.max_attempts}\n\n"
                    f"Error:\n{job.error_message}"
                ),
            ))

    def request_shutdown(self) -> None:
        log.info("Shutdown signal received")
        self._shutdown.set()


async def _main():
    worker = Worker()
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, worker.request_shutdown)
    await worker.run()


if __name__ == "__main__":
    asyncio.run(_main())
