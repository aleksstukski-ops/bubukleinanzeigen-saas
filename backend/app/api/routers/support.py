import asyncio
import html
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import settings
from app.models import User
from app.schemas.support import SupportContactIn
from app.services.email import send_email

log = logging.getLogger("api.support")
router = APIRouter(prefix="/support", tags=["support"])


def _support_recipient() -> str:
    configured = [item.strip() for item in settings.ALERT_EMAIL_TO.split(",") if item.strip()]
    return configured[0] if configured else (settings.SMTP_FROM or settings.SMTP_USER)


@router.post("/contact", status_code=status.HTTP_202_ACCEPTED)
async def contact_support(
    payload: SupportContactIn,
    user: User = Depends(get_current_user),
):
    recipient = _support_recipient()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Support channel not configured",
        )

    body_html = f"""
    <h2>Neue Support-Anfrage</h2>
    <p><strong>User ID:</strong> {user.id}</p>
    <p><strong>Name:</strong> {html.escape(payload.name)}</p>
    <p><strong>E-Mail:</strong> {html.escape(payload.email)}</p>
    <p><strong>Betreff:</strong> {html.escape(payload.subject)}</p>
    <p><strong>Nachricht:</strong></p>
    <div style="white-space:pre-wrap;">{html.escape(payload.message)}</div>
    """

    sent = await asyncio.to_thread(
        send_email,
        to=recipient,
        subject=f"[BubuBay Support] {payload.subject}",
        body_html=body_html,
    )
    if not sent:
        log.error("Support email delivery failed for user %s", user.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Support request could not be delivered",
        )

    return {"success": True}
