from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import AccountStatus, JobType, KleinanzeigenAccount, User
from app.schemas.resources import JobOut, KleinanzeigenAccountCreate, KleinanzeigenAccountOut
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/ka-accounts", tags=["kleinanzeigen-accounts"])


@router.get("", response_model=list[KleinanzeigenAccountOut])
async def list_accounts(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.user_id == user.id).order_by(KleinanzeigenAccount.created_at)
    )
    return result.scalars().all()


@router.post("", response_model=KleinanzeigenAccountOut, status_code=status.HTTP_201_CREATED)
async def create_account(data: KleinanzeigenAccountCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count_result = await db.execute(select(func.count(KleinanzeigenAccount.id)).where(KleinanzeigenAccount.user_id == user.id))
    current_count = count_result.scalar_one()
    if current_count >= user.account_limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Account limit reached for plan '{user.plan}' ({current_count}/{user.account_limit}). Upgrade to add more.",
        )
    account = KleinanzeigenAccount(user_id=user.id, label=data.label, status=AccountStatus.PENDING_LOGIN.value)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    await db.delete(account)
    await db.commit()


@router.post("/{account_id}/start-login", response_model=JobOut)
async def start_login(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    if not account.is_enabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account disabled")

    job = await enqueue_job(
        db,
        JobType.START_LOGIN,
        account_id=account.id,
        payload={"account_id": account.id},
        priority=1,
        max_attempts=1,
    )
    return job


@router.post("/{account_id}/refresh", response_model=JobOut)
async def trigger_refresh(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if account.status != AccountStatus.ACTIVE.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Account not active (status: {account.status})")
    job = await enqueue_job(
        db,
        JobType.SCRAPE_LISTINGS,
        account_id=account.id,
        payload={"account_id": account.id},
        priority=3,
    )
    await enqueue_job(db, JobType.SCRAPE_MESSAGES, account_id=account.id, priority=3)
    return job


@router.post("/{account_id}/verify", response_model=JobOut)
async def verify_session(account_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(KleinanzeigenAccount).where(KleinanzeigenAccount.id == account_id, KleinanzeigenAccount.user_id == user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    job = await enqueue_job(
        db,
        JobType.VERIFY_SESSION,
        account_id=account.id,
        payload={"account_id": account.id},
        priority=2,
    )
    return job
