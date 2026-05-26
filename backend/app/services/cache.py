import json
from typing import Any

from app.shared.queue import queue

LISTINGS_ALL_TTL_SECONDS = 30
ACTIVITY_TTL_SECONDS = 60


def listings_all_cache_key(user_id: int) -> str:
    return f"cache:listings_all:user:{user_id}"


def listings_all_cache_prefix(user_id: int) -> str:
    return f"cache:listings_all:user:{user_id}"


def activity_cache_key(user_id: int, limit: int) -> str:
    return f"cache:activity:user:{user_id}:limit:{limit}"


def activity_cache_prefix(user_id: int) -> str:
    return f"cache:activity:user:{user_id}:"


async def get_cache_json(key: str) -> Any | None:
    try:
        conn = await queue._conn()
        raw = await conn.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


async def set_cache_json(key: str, payload: Any, ttl_seconds: int) -> None:
    try:
        conn = await queue._conn()
        await conn.set(key, json.dumps(payload, ensure_ascii=True), ex=ttl_seconds)
    except Exception:
        return


async def delete_cache_prefix(prefix: str) -> None:
    try:
        conn = await queue._conn()
        cursor: int | str = 0
        while True:
            cursor, keys = await conn.scan(cursor=cursor, match=f"{prefix}*", count=200)
            if keys:
                await conn.delete(*keys)
            if cursor in (0, "0"):
                break
    except Exception:
        return


async def invalidate_listings_cache(user_id: int) -> None:
    await delete_cache_prefix(listings_all_cache_prefix(user_id))


async def invalidate_activity_cache(user_id: int) -> None:
    await delete_cache_prefix(activity_cache_prefix(user_id))
