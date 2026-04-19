import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

log = logging.getLogger("services.email")


def send_email(*, to: str, subject: str, body_html: str) -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        log.error("SMTP not configured, cannot send email")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], [to], msg.as_string())
        log.info("Email sent to %s", to)
        return True
    except Exception as exc:
        log.error("Failed to send email to %s: %s", to, exc)
        return False
