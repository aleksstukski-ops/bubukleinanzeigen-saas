from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.queue import queue

APP_VERSION = "1.0.0"
SCRAPER_HEARTBEAT_KEY = "health:scraper:last_seen"
SCRAPER_HEARTBEAT_TTL_SECONDS = 90
SCRAPER_HEARTBEAT_MAX_AGE_SECONDS = 120


async def check_db(db: AsyncSession) -> bool:
    try:
        await db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def check_redis() -> bool:
    try:
        conn = await queue._conn()
        return bool(await conn.ping())
    except Exception:
        return False


async def mark_scraper_heartbeat() -> None:
    conn = await queue._conn()
    await conn.set(
        SCRAPER_HEARTBEAT_KEY,
        datetime.now(timezone.utc).isoformat(),
        ex=SCRAPER_HEARTBEAT_TTL_SECONDS,
    )


async def clear_scraper_heartbeat() -> None:
    try:
        conn = await queue._conn()
        await conn.delete(SCRAPER_HEARTBEAT_KEY)
    except Exception:
        return


async def check_scraper() -> bool:
    try:
        conn = await queue._conn()
        raw = await conn.get(SCRAPER_HEARTBEAT_KEY)
        if not raw:
            return False
        last_seen = datetime.fromisoformat(raw)
        age_seconds = (datetime.now(timezone.utc) - last_seen).total_seconds()
        return age_seconds <= SCRAPER_HEARTBEAT_MAX_AGE_SECONDS
    except Exception:
        return False
