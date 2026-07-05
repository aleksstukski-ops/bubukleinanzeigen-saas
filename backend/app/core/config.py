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
 # Serialize by default — bursts of parallel requests from one IP are the
 # strongest bot signal and get the IP range blocked.
 SCRAPER_MAX_CONCURRENT_ACCOUNTS: int = 1
 SCRAPER_SESSION_DIR: str = "/app/storage/sessions"

 # Realtime: how often the worker proactively re-scrapes messages for
 # active accounts (seconds). Kept conservative — automated traffic that is
 # too frequent looks like a bot to Kleinanzeigen and gets the IP blocked.
 MESSAGE_POLL_SECONDS: int = 900
 # How often the worker refreshes listings per active account (seconds).
 LISTING_POLL_SECONDS: int = 3600
 # Auto-posting scheduler tick interval (seconds)
 POSTING_SCHEDULER_INTERVAL: int = 60

 # Anti-block pacing: minimum gap (+ up to jitter) between any two
 # Kleinanzeigen page loads across all accounts.
 SCRAPER_MIN_REQUEST_GAP_SECONDS: float = 20.0
 SCRAPER_REQUEST_JITTER_SECONDS: float = 20.0
 # How long to pause ALL scraping after a block page is detected.
 SCRAPER_BLOCK_COOLDOWN_SECONDS: int = 7200  # 2 hours
 # A realistic desktop Chrome user agent (empty = Playwright default, which
 # advertises HeadlessChrome and is trivially bot-detectable).
 SCRAPER_USER_AGENT: str = (
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
  "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
 )

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
