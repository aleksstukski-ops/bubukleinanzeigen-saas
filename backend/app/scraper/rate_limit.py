"""Anti-block safeguards for Kleinanzeigen scraping.

Kleinanzeigen blocks IP ranges that behave like bots: too many requests too
fast, headless fingerprints, bursts across accounts. This module keeps our
traffic human-like and reacts to blocks instead of hammering through them:

- global pacing: a minimum, jittered gap between ANY two Kleinanzeigen page
  loads (single worker process, so an in-process gate is enough)
- a Redis-backed pause: when a block/rate-limit page is detected, all
  scraping stops for a cooldown window (shared with the API so it stops
  triggering background refreshes too, and survives worker restarts)
"""
import asyncio
import logging
import random
import time

from app.core.config import settings
from app.shared.queue import queue

log = logging.getLogger("scraper.rate_limit")

_PAUSE_KEY = "scraper:paused_until"

# In-process pacing state (one scraper process).
_pace_lock = asyncio.Lock()
_last_request_monotonic = 0.0

# Substrings that identify the Kleinanzeigen block / rate-limit page.
_BLOCK_MARKERS = (
    "ip-bereich",
    "voruebergehend gesperrt",
    "vorübergehend gesperrt",
    "zur vorbeugung von betrug",
    "temporarily blocked",
    "unusual traffic",
    " zeitweilig von der nutzung",
)


async def is_paused() -> tuple[bool, int]:
    """Return (paused, seconds_remaining). Never raises — fail open."""
    try:
        conn = await queue._conn()
        raw = await conn.get(_PAUSE_KEY)
        if raw is None:
            return False, 0
        until = float(raw)
        remaining = int(until - time.time())
        if remaining > 0:
            return True, remaining
        return False, 0
    except Exception:
        log.debug("is_paused check failed", exc_info=True)
        return False, 0


async def pause_scraping(seconds: int, reason: str) -> None:
    try:
        conn = await queue._conn()
        until = time.time() + seconds
        await conn.set(_PAUSE_KEY, until, ex=seconds + 60)
        log.warning("Scraping paused for %ss: %s", seconds, reason)
    except Exception:
        log.exception("Failed to set scraping pause")


async def clear_pause() -> None:
    try:
        conn = await queue._conn()
        await conn.delete(_PAUSE_KEY)
        log.info("Scraping pause cleared")
    except Exception:
        log.exception("Failed to clear scraping pause")


def looks_blocked(page_text: str) -> bool:
    lowered = (page_text or "").lower()
    return any(marker in lowered for marker in _BLOCK_MARKERS)


async def detect_block(page) -> bool:
    """If the current page is a Kleinanzeigen block page, start the cooldown.

    Returns True when a block was detected (caller should abort the job).
    """
    try:
        text = await page.content()
    except Exception:
        return False
    if looks_blocked(text):
        await pause_scraping(
            settings.SCRAPER_BLOCK_COOLDOWN_SECONDS,
            f"Kleinanzeigen block page detected at {page.url}",
        )
        return True
    return False


async def pace() -> None:
    """Block until the global minimum gap since the last request has elapsed.

    Adds jitter so the cadence is not perfectly regular (a bot tell).
    """
    global _last_request_monotonic
    async with _pace_lock:
        gap = settings.SCRAPER_MIN_REQUEST_GAP_SECONDS + random.uniform(
            0, settings.SCRAPER_REQUEST_JITTER_SECONDS
        )
        wait = _last_request_monotonic + gap - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        _last_request_monotonic = time.monotonic()
