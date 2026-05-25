from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.health import APP_VERSION, check_db, check_redis, check_scraper

router = APIRouter(prefix="/health", tags=["health"])


class HealthCheckOut(BaseModel):
    status: str
    db: bool
    redis: bool
    scraper: bool
    version: str


@router.get("", response_model=HealthCheckOut)
async def get_health(
    db: AsyncSession = Depends(get_db),
):
    db_ok = await check_db(db)
    redis_ok = await check_redis()
    scraper_ok = await check_scraper()

    return HealthCheckOut(
        status="ok" if db_ok and redis_ok and scraper_ok else "degraded",
        db=db_ok,
        redis=redis_ok,
        scraper=scraper_ok,
        version=APP_VERSION,
    )
