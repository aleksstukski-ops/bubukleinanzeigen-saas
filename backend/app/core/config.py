from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
 model_config = SettingsConfigDict(env_file=".env", extra="ignore")

 SECRET_KEY: str
 FERNET_KEY: str
 ALGORITHM: str = "HS256"
 ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
 REFRESH_TOKEN_EXPIRE_DAYS: int = 30

 DATABASE_URL: str

 REDIS_URL: str = "redis://redis:6379/0"

 ALLOWED_ORIGINS: str = "http://localhost:3000"

 PLAYWRIGHT_HEADLESS: bool = True
 SCRAPER_MAX_CONCURRENT_ACCOUNTS: int = 5
 SCRAPER_SESSION_DIR: str = "/app/storage/sessions"

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
 VAPID_SUBJECT: str = "mailto:admin@bubuanzeigen.de"

 # Stripe
 STRIPE_SECRET_KEY: str = ""
 STRIPE_WEBHOOK_SECRET: str = ""
 STRIPE_PRICE_STARTER: str = ""
 STRIPE_PRICE_PRO: str = ""
 STRIPE_PRICE_BUSINESS: str = ""
 FRONTEND_URL: str = "https://bubuanzeigen.de"

 @property
 def allowed_origins_list(self):
  return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings():
 return Settings()


settings = get_settings()
