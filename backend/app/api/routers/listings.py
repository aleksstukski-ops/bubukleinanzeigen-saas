import csv
import io
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import JobType, KleinanzeigenAccount, Listing, User
from app.models.domain import ListingStat
from app.schemas.resources import (
    BulkActionIn,
    BulkPriceIn,
    BumpScheduleIn,
    CreateListingIn,
    JobOut,
    ListingActionIn,
    ListingListResponse,
    ListingOut,
    ListingStatOut,
    ListingUpdateIn,
)
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/listings", tags=["listings"])
STALE_SECONDS = 120


class AutoBumpScheduleIn(BaseModel):
    account_id: int
    listing_id: str = Field(min_length=1, max_length=64)
    interval_hours: int = Field(ge=24, le=720, multiple_of=24)


async def _get_account_for_user(
    db: AsyncSession,
    *,
    account_id: int,
    user_id: int,
) -> KleinanzeigenAccount:
    acc_result = await db.execute(
        select(KleinanzeigenAccount).where(
            KleinanzeigenAccount.id == account_id,
            KleinanzeigenAccount.user_id == user_id,
        )
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def _get_listing_for_user(
    db: AsyncSession,
    *,
    kleinanzeigen_id: str,
    user_id: int,
) -> Listing:
    result = await db.execute(
        select(Listing)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Listing.account_id)
        .where(
            Listing.kleinanzeigen_id == kleinanzeigen_id,
            KleinanzeigenAccount.user_id == user_id,
        )
    )
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@router.get("/all", response_model=list[ListingOut])
async def list_all_listings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all active listings for all accounts belonging to this user — single DB query."""
    result = await db.execute(
        select(Listing)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Listing.account_id)
        .where(
            KleinanzeigenAccount.user_id == user.id,
            Listing.is_active.is_(True),
        )
        .order_by(Listing.last_scraped_at.desc())
    )
    return result.scalars().all()


@router.get("", response_model=ListingListResponse)
async def list_listings(
    account_id: int = Query(..., description="Kleinanzeigen account id"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=account_id, user_id=user.id)

    result = await db.execute(
        select(Listing)
        .where(Listing.account_id == account_id, Listing.is_active.is_(True))
        .order_by(Listing.last_scraped_at.desc())
    )
    listings = result.scalars().all()

    last_updated = max((listing.last_scraped_at for listing in listings), default=None)
    is_stale = True

    if last_updated is not None:
        age = (datetime.now(timezone.utc) - last_updated).total_seconds()
        is_stale = age > STALE_SECONDS

    if is_stale and account.status == "active":
        await enqueue_job(db, JobType.SCRAPE_LISTINGS, account_id=account.id, priority=5)

    return ListingListResponse(items=listings, stale=is_stale, last_updated=last_updated)


@router.post("/create", response_model=JobOut)
async def create_listing(
    payload: CreateListingIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue a CREATE_LISTING job that uses Playwright to post a new ad."""
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)

    job = await enqueue_job(
        db,
        JobType.CREATE_LISTING,
        account_id=account.id,
        payload={
            "title": payload.title,
            "description": payload.description,
            "price": payload.price,
            "category_id": payload.category_id,
            "location": payload.location,
        },
        priority=3,
    )
    return job


_CSV_REQUIRED_HEADERS = {"title"}
_CSV_OPTIONAL_HEADERS = {"description", "price", "category_id", "location"}
_CSV_MAX_ROWS = 30


def _decode_upload(raw: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise HTTPException(status_code=400, detail="CSV-Datei: Encoding nicht erkannt (UTF-8 erwartet).")


def _detect_dialect(sample: str) -> csv.Dialect:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        return csv.excel


@router.post("/import-csv", response_model=list[JobOut])
async def import_listings_csv(
    account_id: int = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import 1-30 listings from a CSV file. Each row becomes a CREATE_LISTING job.

    Required column: title. Optional: description, price, category_id, location.
    Excel-style (;) and TSV separators are detected automatically.
    """
    account = await _get_account_for_user(db, account_id=account_id, user_id=user.id)

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="CSV-Datei ist leer.")
    if len(raw) > 1_000_000:
        raise HTTPException(status_code=400, detail="CSV-Datei zu gross (max. 1 MB).")

    text = _decode_upload(raw)
    sample = text[:2048]
    dialect = _detect_dialect(sample)
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)

    headers = {h.strip().lower() for h in (reader.fieldnames or [])}
    missing = _CSV_REQUIRED_HEADERS - headers
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV: fehlende Spalten: {', '.join(sorted(missing))}",
        )

    jobs: list = []
    for index, row in enumerate(reader, start=2):  # start=2 because header is row 1
        if len(jobs) >= _CSV_MAX_ROWS:
            raise HTTPException(
                status_code=400,
                detail=f"CSV enthaelt mehr als {_CSV_MAX_ROWS} Zeilen — bitte in Etappen importieren.",
            )

        normalized = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        title = normalized.get("title", "")
        if not title:
            # Skip empty rows silently — common in spreadsheet exports
            continue
        if len(title) > 500:
            raise HTTPException(status_code=400, detail=f"Zeile {index}: Titel zu lang (max. 500 Zeichen).")

        description = normalized.get("description") or None
        price = normalized.get("price") or None
        category_id = normalized.get("category_id") or None
        location = normalized.get("location") or None

        job = await enqueue_job(
            db,
            JobType.CREATE_LISTING,
            account_id=account.id,
            payload={
                "title": title,
                "description": description,
                "price": price,
                "category_id": category_id,
                "location": location,
            },
            priority=4,
        )
        jobs.append(job)

    if not jobs:
        raise HTTPException(status_code=400, detail="CSV enthaelt keine verwertbaren Zeilen.")

    return jobs


_PRICE_NUMBER_RE = re.compile(r"(\d+(?:[\.,]\d+)?)")


def _parse_listing_price(raw: str | None) -> float | None:
    if not raw:
        return None
    match = _PRICE_NUMBER_RE.search(raw.replace(".", "").replace(",", "."))
    if match is None:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def _format_price(value: float) -> str:
    rounded = round(value)
    if rounded < 1:
        rounded = 1
    return f"{int(rounded)} EUR"


def _compute_new_price(current: str | None, mode: str, value: float) -> str | None:
    base = _parse_listing_price(current)
    if base is None:
        # VB / Zu verschenken / no parsable number — skip
        return None
    if mode == "absolute":
        new_value = value
    elif mode == "percent_increase":
        new_value = base * (1 + value / 100)
    elif mode == "percent_decrease":
        new_value = base * (1 - value / 100)
    else:
        return None
    if new_value <= 0:
        return None
    return _format_price(new_value)


@router.post("/bulk-price", response_model=list[JobOut])
async def bulk_price(
    payload: BulkPriceIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply an absolute or percentage price change across many listings.

    mode="absolute" sets every listing's price to value EUR (value > 0).
    mode="percent"  multiplies the current price; positive value = increase,
                    negative value = decrease. Listings without a numeric
                    current price (VB, Zu verschenken) are skipped silently
                    — the response only contains the jobs actually enqueued.
    """
    if payload.mode not in ("absolute", "percent"):
        raise HTTPException(status_code=400, detail="mode must be 'absolute' or 'percent'")
    if payload.mode == "absolute" and payload.value <= 0:
        raise HTTPException(status_code=400, detail="absolute value must be > 0")
    if payload.mode == "percent" and (payload.value <= -100 or payload.value == 0):
        raise HTTPException(
            status_code=400,
            detail="percent value must be non-zero and greater than -100",
        )

    # Map the cleaner public {absolute, percent+signed value} interface onto
    # the existing 3-mode internal helper.
    if payload.mode == "absolute":
        internal_mode, internal_value = "absolute", payload.value
    elif payload.value > 0:
        internal_mode, internal_value = "percent_increase", payload.value
    else:
        internal_mode, internal_value = "percent_decrease", abs(payload.value)

    result = await db.execute(
        select(Listing)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Listing.account_id)
        .where(
            Listing.kleinanzeigen_id.in_(payload.listing_ids),
            KleinanzeigenAccount.user_id == user.id,
            Listing.is_active.is_(True),
        )
    )
    listings = result.scalars().all()

    jobs: list = []
    for listing in listings:
        new_price = _compute_new_price(listing.price, internal_mode, internal_value)
        if new_price is None:
            continue
        job = await enqueue_job(
            db, JobType.UPDATE_LISTING,
            account_id=listing.account_id,
            payload={
                "listing_id": listing.kleinanzeigen_id,
                "title": listing.title,
                "price": new_price,
                "description": listing.description,
            },
            priority=3,
        )
        jobs.append(job)

    return jobs


@router.post("/bulk-action", response_model=list[JobOut])
async def bulk_action(
    payload: BulkActionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue bulk jobs (bump / delete / price_change / scrape_description)."""
    allowed_actions = ("bump", "delete", "price_change", "scrape_description")
    if payload.action not in allowed_actions:
        raise HTTPException(
            status_code=400,
            detail=f"action must be one of {allowed_actions}",
        )

    if payload.action == "price_change":
        if payload.price_mode not in ("absolute", "percent_increase", "percent_decrease"):
            raise HTTPException(
                status_code=400,
                detail="price_mode must be absolute/percent_increase/percent_decrease",
            )
        if payload.price_value is None:
            raise HTTPException(status_code=400, detail="price_value is required for price_change")

    # Fetch all matching listings that belong to this user
    result = await db.execute(
        select(Listing)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Listing.account_id)
        .where(
            Listing.kleinanzeigen_id.in_(payload.listing_ids),
            KleinanzeigenAccount.user_id == user.id,
            Listing.is_active.is_(True),
        )
    )
    listings = result.scalars().all()

    jobs: list = []
    for listing in listings:
        if payload.action == "bump":
            job = await enqueue_job(
                db, JobType.BUMP_LISTING,
                account_id=listing.account_id,
                payload={"listing_id": listing.kleinanzeigen_id},
                priority=3,
            )
        elif payload.action == "delete":
            job = await enqueue_job(
                db, JobType.DELETE_LISTING,
                account_id=listing.account_id,
                payload={"listing_id": listing.kleinanzeigen_id},
                priority=3,
            )
        elif payload.action == "scrape_description":
            if not listing.url:
                continue
            job = await enqueue_job(
                db, JobType.SCRAPE_LISTING_DETAIL,
                account_id=listing.account_id,
                payload={"listing_id": listing.kleinanzeigen_id, "url": listing.url},
                priority=6,
                deduplicate=False,
            )
        elif payload.action == "price_change":
            new_price = _compute_new_price(listing.price, payload.price_mode, payload.price_value)
            if new_price is None:
                # Listing has no numeric price (VB, Zu verschenken) — skip
                continue
            job = await enqueue_job(
                db, JobType.UPDATE_LISTING,
                account_id=listing.account_id,
                payload={
                    "listing_id": listing.kleinanzeigen_id,
                    "title": listing.title,
                    "price": new_price,
                    "description": listing.description,
                },
                priority=3,
            )
        else:
            continue
        jobs.append(job)

    return jobs


@router.get("/{listing_id}/stats", response_model=list[ListingStatOut])
async def get_listing_stats(
    listing_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return historical view/bookmark stats for a listing (last 30 days, max 200 points)."""
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)
    result = await db.execute(
        select(ListingStat)
        .where(ListingStat.listing_id == listing.id)
        .order_by(ListingStat.scraped_at.desc())
        .limit(200)
    )
    return result.scalars().all()


@router.post("/{listing_id}/bump", response_model=JobOut)
async def bump_listing(
    listing_id: str,
    payload: ListingActionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    job = await enqueue_job(
        db,
        JobType.BUMP_LISTING,
        account_id=account.id,
        payload={"listing_id": listing.kleinanzeigen_id},
        priority=2,
    )
    return job


@router.patch("/{listing_id}", response_model=JobOut)
async def update_listing(
    listing_id: str,
    payload: ListingUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    job = await enqueue_job(
        db,
        JobType.UPDATE_LISTING,
        account_id=account.id,
        payload={
            "listing_id": listing.kleinanzeigen_id,
            "title": payload.title if payload.title is not None else listing.title,
            "price": payload.price if payload.price is not None else listing.price,
            "description": payload.description if payload.description is not None else listing.description,
        },
        priority=3,
    )
    return job


@router.patch("/{listing_id}/bump-schedule", response_model=ListingOut)
async def set_bump_schedule(
    listing_id: str,
    payload: BumpScheduleIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or clear the auto-bump schedule for a listing."""
    from datetime import timedelta
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    listing.bump_interval_days = payload.bump_interval_days
    if payload.bump_interval_days is not None:
        listing.next_bump_at = datetime.now(timezone.utc) + timedelta(days=payload.bump_interval_days)
    else:
        listing.next_bump_at = None

    await db.commit()
    await db.refresh(listing)
    return listing


@router.get("/auto-bump", response_model=list[ListingOut])
async def list_auto_bump_schedules(
    account_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Listing)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Listing.account_id)
        .where(
            KleinanzeigenAccount.user_id == user.id,
            Listing.bump_interval_days.is_not(None),
        )
        .order_by(Listing.next_bump_at.asc().nullslast(), Listing.id.desc())
    )

    if account_id is not None:
        query = query.where(Listing.account_id == account_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/auto-bump", response_model=ListingOut)
async def create_auto_bump_schedule(
    payload: AutoBumpScheduleIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=payload.listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    listing.bump_interval_days = payload.interval_hours // 24
    listing.next_bump_at = datetime.now(timezone.utc) + timedelta(hours=payload.interval_hours)
    await db.commit()
    await db.refresh(listing)
    return listing


@router.delete("/auto-bump", response_model=ListingOut)
async def delete_auto_bump_schedule(
    listing_id: str = Query(..., min_length=1, max_length=64),
    account_id: int = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    listing.bump_interval_days = None
    listing.next_bump_at = None
    await db.commit()
    await db.refresh(listing)
    return listing


@router.delete("/{listing_id}", response_model=JobOut)
async def delete_listing(
    listing_id: str,
    payload: ListingActionIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = await _get_account_for_user(db, account_id=payload.account_id, user_id=user.id)
    listing = await _get_listing_for_user(db, kleinanzeigen_id=listing_id, user_id=user.id)

    if listing.account_id != account.id:
        raise HTTPException(status_code=400, detail="Listing does not belong to account")

    job = await enqueue_job(
        db,
        JobType.DELETE_LISTING,
        account_id=account.id,
        payload={"listing_id": listing.kleinanzeigen_id},
        priority=3,
    )
    return job
