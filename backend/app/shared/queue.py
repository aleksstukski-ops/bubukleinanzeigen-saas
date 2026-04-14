import json
from typing import Any
import redis.asyncio as aioredis
from app.core.config import settings

HIGH = "jobs:high"
NORMAL = "jobs:normal"
LOW = "jobs:low"
QUEUES_BY_PRIORITY = [HIGH, NORMAL, LOW]


def _queue_for_priority(priority: int) -> str:
    if priority <= 3:
        return HIGH
    if priority <= 6:
        return NORMAL
    return LOW


class JobQueue:
    def __init__(self, url: str | None = None):
        self._url = url or settings.REDIS_URL
        self._redis: aioredis.Redis | None = None

    async def _conn(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(self._url, encoding="utf-8", decode_responses=True)
        return self._redis

    async def push(self, job_id: int, priority: int = 5) -> None:
        r = await self._conn()
        queue = _queue_for_priority(priority)
        await r.rpush(queue, json.dumps({"job_id": job_id}))

    async def pop(self, timeout: int = 5) -> dict[str, Any] | None:
        r = await self._conn()
        result = await r.blpop(QUEUES_BY_PRIORITY, timeout=timeout)
        if result is None:
            return None
        _queue_name, raw = result
        return json.loads(raw)

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None


queue = JobQueue()
