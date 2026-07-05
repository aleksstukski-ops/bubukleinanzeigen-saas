import json
import logging
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

log = logging.getLogger("events")

_CHANNEL_PREFIX = "events:user:"

_redis: aioredis.Redis | None = None


def _conn() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis


async def publish_event(user_id: int, event_type: str, data: dict[str, Any] | None = None) -> None:
    """Publish a realtime event for one user via Redis pub/sub.

    Fire-and-forget: event delivery must never break the caller (scrape jobs,
    API handlers). Failures are logged and swallowed.
    """
    try:
        payload = json.dumps({
            "type": event_type,
            "data": data or {},
            "at": datetime.now(timezone.utc).isoformat(),
        })
        await _conn().publish(f"{_CHANNEL_PREFIX}{user_id}", payload)
    except Exception:
        log.warning("publish_event failed (type=%s user=%s)", event_type, user_id, exc_info=True)


async def open_subscription(user_id: int):
    """Open a Redis pub/sub subscription for one user's event channel.

    Caller is responsible for closing via close_subscription().
    """
    pubsub = _conn().pubsub()
    await pubsub.subscribe(f"{_CHANNEL_PREFIX}{user_id}")
    return pubsub


async def close_subscription(pubsub, user_id: int) -> None:
    try:
        await pubsub.unsubscribe(f"{_CHANNEL_PREFIX}{user_id}")
        await pubsub.close()
    except Exception:
        log.debug("close_subscription failed for user %s", user_id, exc_info=True)
