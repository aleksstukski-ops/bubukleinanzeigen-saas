from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (
    KleinanzeigenAccount,
    ListingTemplate,
    PostingSchedule,
    ScheduledListing,
    User,
)
from app.schemas.resources import (
    PostingScheduleIn,
    PostingScheduleOut,
    ScheduledListingIn,
    ScheduledListingOut,
)

router = APIRouter(prefix="/posting", tags=["posting"])


async def _get_own_account(db: AsyncSession, user_id: int, account_id: int) -> KleinanzeigenAccount:
    result = await db.execute(
        select(KleinanzeigenAccount).where(
            KleinanzeigenAccount.id == account_id,
            KleinanzeigenAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.get("/schedules", response_model=list[PostingScheduleOut])
async def list_schedules(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PostingSchedule)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == PostingSchedule.account_id)
        .where(KleinanzeigenAccount.user_id == user.id)
        .order_by(PostingSchedule.account_id)
    )
    return result.scalars().all()


@router.put("/schedules/{account_id}", response_model=PostingScheduleOut)
async def upsert_schedule(
    account_id: int,
    data: PostingScheduleIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_own_account(db, user.id, account_id)
    if data.window_end_hour <= data.window_start_hour:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zeitfenster ungueltig: Ende muss nach Start liegen.",
        )

    result = await db.execute(
        select(PostingSchedule).where(PostingSchedule.account_id == account_id)
    )
    schedule = result.scalar_one_or_none()
    if schedule is None:
        schedule = PostingSchedule(account_id=account_id)
        db.add(schedule)

    schedule.is_enabled = data.is_enabled
    schedule.posts_per_day = data.posts_per_day
    schedule.window_start_hour = data.window_start_hour
    schedule.window_end_hour = data.window_end_hour
    await db.commit()
    await db.refresh(schedule)
    return schedule


@router.get("/queue", response_model=list[ScheduledListingOut])
async def list_queue(
    account_id: int | None = Query(None),
    include_done: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ScheduledListing).where(ScheduledListing.user_id == user.id)
    if account_id is not None:
        query = query.where(ScheduledListing.account_id == account_id)
    if not include_done:
        query = query.where(ScheduledListing.status.in_(["queued", "posting", "failed"]))
    query = query.order_by(ScheduledListing.id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/queue", response_model=ScheduledListingOut, status_code=status.HTTP_201_CREATED)
async def add_to_queue(
    data: ScheduledListingIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_own_account(db, user.id, data.account_id)
    item = ScheduledListing(
        user_id=user.id,
        account_id=data.account_id,
        title=data.title.strip(),
        description=(data.description or None),
        price=(data.price or None),
        category_id=(data.category_id or None),
        location=(data.location or None),
        status="queued",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/queue/from-template/{template_id}", response_model=ScheduledListingOut, status_code=status.HTTP_201_CREATED)
async def add_from_template(
    template_id: int,
    account_id: int = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_own_account(db, user.id, account_id)
    result = await db.execute(
        select(ListingTemplate).where(
            ListingTemplate.id == template_id,
            ListingTemplate.user_id == user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vorlage nicht gefunden")
    if not (template.title or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vorlage hat keinen Titel — bitte Vorlage vervollstaendigen.",
        )
    item = ScheduledListing(
        user_id=user.id,
        account_id=account_id,
        title=template.title.strip(),
        description=template.description,
        price=template.price,
        category_id=template.category_id,
        location=template.location,
        status="queued",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/queue/{item_id}/retry", response_model=ScheduledListingOut)
async def retry_queue_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScheduledListing).where(
            ScheduledListing.id == item_id,
            ScheduledListing.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eintrag nicht gefunden")
    if item.status != "failed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nur fehlgeschlagene Eintraege koennen wiederholt werden")
    item.status = "queued"
    item.error = None
    item.job_id = None
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/queue/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_queue_item(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ScheduledListing).where(
            ScheduledListing.id == item_id,
            ScheduledListing.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Eintrag nicht gefunden")
    if item.status == "posting":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Eintrag wird gerade veroeffentlicht")
    await db.delete(item)
    await db.commit()
