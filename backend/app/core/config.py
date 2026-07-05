from functools import lru_cache
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_ALLOWED_ORIGINS = [
 "https://bububay.de",
 "https://www.bububay.de",
 "http://localhost:3000",
 "http://127.0.0.1:3000",
]
_ALLOWED_ORIGIN_HOSTS = {"bububay.de", "www.bububay.de", "localhost", "127.0.0.1"}


class Settings(BaseSettings):
 # env_file is tried in order — first hit wins. Covers both:
 #   - docker (CWD = project root, ".env" matches)
 #   - host cli_login (CWD = backend/, "../.env" matches)
 model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

 SECRET_KEY: str
 FERNET_KEY: str
 ALGORITHM: str = "HS256"
 ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
 REFRESH_TOKEN_EXPIRE_DAYS: int = 30

 DATABASE_URL: str

 REDIS_URL: str = "redis://redis:6379/0"

 ALLOWED_ORIGINS: str = ",".join(_DEFAULT_ALLOWED_ORIGINS)

 PLAYWRIGHT_HEADLESS: bool = True
 SCRAPER_MAX_CONCURRENT_ACCOUNTS: int = 5
 SCRAPER_SESSION_DIR: str = "/app/storage/sessions"

 # Realtime: how often the worker proactively re-scrapes messages for
 # active accounts (seconds). Lower = closer to realtime, more load.
 MESSAGE_POLL_SECONDS: int = 90
 # Auto-posting scheduler tick interval (seconds)
 POSTING_SCHEDULER_INTERVAL: int = 60

 # SMTP
 SMTP_HOST: str = "smtp.gmail.com"
 SMTP_PORT: int = 587
 SMTP_USER: str = ""
 SMTP_PASSWORD: str = ""
 SMTP_FROM: str = ""
 ALERT_EMAIL_TO: str = ""  # comma-separated list of alert recipients

 # Telegram alerts
 TELEGRAM_BOT_TOKEN: str = ""
 TELEGRAM_CHAT_ID: str = ""

 # VAPID (Web Push)
 VAPID_PRIVATE_KEY: str = ""
 VAPID_PUBLIC_KEY: str = ""
 VAPID_SUBJECT: str = "mailto:admin@bububay.de"

 # Stripe
 STRIPE_SECRET_KEY: str = ""
 STRIPE_WEBHOOK_SECRET: str = ""
 STRIPE_PRICE_STARTER: str = ""
 STRIPE_PRICE_PRO: str = ""
 STRIPE_PRICE_BUSINESS: str = ""
 FRONTEND_URL: str = "https://bububay.de"

 @property
 def allowed_origins_list(self):
  configured = [o.strip().rstrip("/") for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
  safe_origins: list[str] = []
  for origin in configured:
   parsed = urlparse(origin)
   if parsed.scheme not in {"http", "https"} or not parsed.netloc:
    continue
   if "*" in origin:
    continue
   host = parsed.hostname or ""
   if host not in _ALLOWED_ORIGIN_HOSTS:
    continue
   if host in {"bububay.de", "www.bububay.de"} and parsed.scheme != "https":
    continue
   safe_origins.append(origin)

  if not safe_origins:
   return list(_DEFAULT_ALLOWED_ORIGINS)

  deduped: list[str] = []
  for origin in safe_origins:
   if origin not in deduped:
    deduped.append(origin)
  return deduped


@lru_cache
def get_settings():
 return Settings()


settings = get_settings()
