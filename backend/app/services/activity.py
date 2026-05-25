import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

_LOG_LOCK = Lock()
_ACTIVITY_LOG_PATH = Path(__file__).resolve().parents[2] / "storage" / "activity.jsonl"


def log_activity(
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


def get_activity_entries(*, user_id: int, limit: int = 50) -> list[dict[str, Any]]:
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
