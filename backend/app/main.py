import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routers import auth, billing, kleinanzeigen_accounts, jobs, listings, messages

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(
    title="BubuKleinanzeigen API",
    description="Multi-Account Kleinanzeigen.de Management — SaaS Backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(billing.router, prefix="/api")
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
