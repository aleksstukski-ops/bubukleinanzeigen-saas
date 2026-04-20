"""Alert service — sends notifications via email (SMTP) and/or Telegram Bot API."""
import asyncio
import logging
import smtplib
import socket
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

log = logging.getLogger("services.alerts")


def _send_email_sync(subject: str, body: str) -> None:
    """Blocking SMTP send — run via asyncio.to_thread."""
    recipients = [r.strip() for r in settings.ALERT_EMAIL_TO.split(",") if r.strip()]
    if not recipients or not settings.SMTP_USER or not settings.SMTP_FROM:
        return

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = ", ".join(recipients)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(settings.SMTP_FROM, recipients, msg.as_string())
        log.info("Alert email sent to %s", recipients)
    except (smtplib.SMTPException, socket.error) as exc:
        log.error("Failed to send alert email: %s", exc)


async def _send_telegram(text: str) -> None:
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json={
                "chat_id": settings.TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "HTML",
            })
            resp.raise_for_status()
        log.info("Alert sent to Telegram chat %s", settings.TELEGRAM_CHAT_ID)
    except httpx.HTTPError as exc:
        log.error("Failed to send Telegram alert: %s", exc)


async def send_alert(subject: str, body: str) -> None:
    """Fire-and-forget alert via email and Telegram. Errors are logged, never raised."""
    tasks = []
    if settings.ALERT_EMAIL_TO and settings.SMTP_USER:
        tasks.append(asyncio.to_thread(_send_email_sync, subject, body))
    if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
        tasks.append(_send_telegram(f"<b>{subject}</b>\n\n{body}"))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
