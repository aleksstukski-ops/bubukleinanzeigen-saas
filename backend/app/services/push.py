"""Web Push notification service using VAPID."""
import json
import logging

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push_subscription import PushSubscription

log = logging.getLogger("services.push")


async def send_push_to_user(
    db: AsyncSession,
    user_id: int,
    *,
    title: str,
    body: str,
    url: str = "/messages",
) -> int:
    """Send a push notification to all subscriptions of a user. Returns number sent."""
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return 0

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subs = result.scalars().all()
    if not subs:
        return 0

    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0
    stale_ids = []

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY.replace("\\n", "\n"),
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                # Subscription expired — remove it
                stale_ids.append(sub.id)
                log.info("Push subscription %s gone (status %s), removing", sub.id, status)
            else:
                log.warning("Push failed for sub %s: %s", sub.id, exc)
        except Exception as exc:
            log.warning("Push error for sub %s: %s", sub.id, exc)

    # Clean up expired subscriptions
    for sid in stale_ids:
        stale = await db.get(PushSubscription, sid)
        if stale:
            await db.delete(stale)
    if stale_ids:
        await db.commit()

    return sent
