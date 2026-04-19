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

 @property
 def allowed_origins_list(self):
  return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings():
 return Settings()


settings = get_settings()
