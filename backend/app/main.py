import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import settings
from app.api.routers import admin, auth, billing, kleinanzeigen_accounts, jobs, listings, messages, push

log = logging.getLogger("api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# Rate limiter — keyed by client IP
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(
    title="BubuKleinanzeigen API",
    description="Multi-Account Kleinanzeigen.de Management — SaaS Backend",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Ein interner Fehler ist aufgetreten. Bitte versuche es später erneut."},
    )


app.include_router(admin.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(billing.router, prefix="/api")
app.include_router(push.router, prefix="/api")
app.include_router(kleinanzeigen_accounts.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(listings.router, prefix="/api")
app.include_router(messages.router, prefix="/api")


@app.get("/api/health", tags=["health"])
async def health():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
async def root():
    return {"service": "bubukleinanzeigen-api", "docs": "/docs"}
