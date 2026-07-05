import logging

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.core.security import decode_token
from app.db.session import AsyncSessionLocal
from app.models import User
from app.shared.events import close_subscription, open_subscription

log = logging.getLogger("api.events")

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/stream")
async def stream_events(request: Request, token: str = Query(...)):
    """Server-Sent-Events stream with realtime updates for the current user.

    EventSource cannot send an Authorization header, so the access token is
    passed as a query parameter and validated the same way as in deps.py.
    The stream reconnects client-side when the token expires (401 on connect).
    """
    payload = decode_token(token, expected_type="access")
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User.id, User.is_active).where(User.id == user_id))
        row = result.first()
        if row is None or not row.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    async def event_source():
        pubsub = await open_subscription(user_id)
        try:
            # Tell the browser to wait 5s before reconnect attempts
            yield "retry: 5000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=15)
                if message is None:
                    # Keepalive comment so proxies do not kill the connection
                    yield ": keepalive\n\n"
                    continue
                data = message.get("data")
                if data:
                    yield f"data: {data}\n\n"
        finally:
            await close_subscription(pubsub, user_id)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Disable buffering in Nginx so events arrive immediately
            "X-Accel-Buffering": "no",
        },
    )
