import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityLog
from app.services.cache import invalidate_activity_cache

_LOG_LOCK = Lock()
_ACTIVITY_LOG_PATH = Path(__file__).resolve().parents[2] / "storage" / "activity.jsonl"


def _serialize_entry(entry: ActivityLog) -> dict[str, Any]:
    return {
        "timestamp": entry.created_at.isoformat(),
        "action": entry.action,
        "user_id": entry.user_id,
        "account_id": entry.account_id,
        "listing_id": entry.listing_id,
        "details": entry.details or {},
    }


def _legacy_log_activity(
    *,
    action: str,
    user_id: int,
    account_id: int | None = None,
    listing_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "user_id": user_id,
        "account_id": account_id,
        "listing_id": listing_id,
        "details": details or {},
    }

    _ACTIVITY_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _LOG_LOCK:
        with _ACTIVITY_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=True) + "\n")

    return entry


def _legacy_get_activity_entries(*, user_id: int, limit: int = 50) -> list[dict[str, Any]]:
    if limit < 1:
        return []
    if not _ACTIVITY_LOG_PATH.exists():
        return []

    entries: list[dict[str, Any]] = []
    with _LOG_LOCK:
        lines = _ACTIVITY_LOG_PATH.read_text(encoding="utf-8").splitlines()

    for line in reversed(lines):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("user_id") != user_id:
            continue
        entries.append(entry)
        if len(entries) >= limit:
            break

    return entries


async def log_activity(
    db: AsyncSession,
    *,
    action: str,
    user_id: int,
    account_id: int | None = None,
    listing_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    try:
        entry = ActivityLog(
            user_id=user_id,
            account_id=account_id,
            listing_id=listing_id,
            action=action,
            details=details or {},
        )
        db.add(entry)
        await db.commit()
        await db.refresh(entry)
        payload = _serialize_entry(entry)
    except Exception:
        await db.rollback()
        payload = _legacy_log_activity(
            action=action,
            user_id=user_id,
            account_id=account_id,
            listing_id=listing_id,
            details=details,
        )

    await invalidate_activity_cache(user_id)
    return payload


async def get_activity_entries(
    db: AsyncSession,
    *,
    user_id: int,
    limit: int = 50,
) -> list[dict[str, Any]]:
    try:
        result = await db.execute(
            select(ActivityLog)
            .where(ActivityLog.user_id == user_id)
            .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
            .limit(limit)
        )
        return [_serialize_entry(entry) for entry in result.scalars().all()]
    except Exception:
        return _legacy_get_activity_entries(user_id=user_id, limit=limit)
