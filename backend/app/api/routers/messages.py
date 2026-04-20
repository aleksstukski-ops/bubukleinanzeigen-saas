from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Conversation, JobType, KleinanzeigenAccount, Message, User
from app.schemas.resources import ConversationOut, JobOut, MessageOut, SendMessageIn
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/messages", tags=["messages"])
STALE_SECONDS = 120


async def _get_conversation_for_user(
    db: AsyncSession,
    *,
    conversation_id: int,
    user_id: int,
) -> tuple[Conversation, KleinanzeigenAccount]:
    result = await db.execute(
        select(Conversation, KleinanzeigenAccount)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Conversation.account_id)
        .where(
            Conversation.id == conversation_id,
            KleinanzeigenAccount.user_id == user_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return row


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    account_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Conversation)
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Conversation.account_id)
        .where(KleinanzeigenAccount.user_id == user.id)
        .order_by(Conversation.last_message_at.desc().nullslast(), Conversation.id.desc())
    )

    if account_id is not None:
        query = query.where(Conversation.account_id == account_id)

    result = await db.execute(query)
    conversations = result.scalars().all()

    # Determine latest scrape time per account (no DB query per account)
    latest_by_account: dict[int, datetime | None] = {}
    for conversation in conversations:
        current_latest = latest_by_account.get(conversation.account_id)
        if current_latest is None or (
            conversation.last_scraped_at and current_latest < conversation.last_scraped_at
        ):
            latest_by_account[conversation.account_id] = conversation.last_scraped_at

    now = datetime.now(timezone.utc)
    stale_account_ids = [
        aid for aid, last_scraped_at in latest_by_account.items()
        if last_scraped_at is None or (now - last_scraped_at).total_seconds() > STALE_SECONDS
    ]

    if stale_account_ids:
        # Single batch query instead of N individual queries
        active_result = await db.execute(
            select(KleinanzeigenAccount).where(
                KleinanzeigenAccount.id.in_(stale_account_ids),
                KleinanzeigenAccount.user_id == user.id,
                KleinanzeigenAccount.status == "active",
            )
        )
        for account in active_result.scalars().all():
            await enqueue_job(db, JobType.SCRAPE_MESSAGES, account_id=account.id, priority=4)

    return conversations


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation, account = await _get_conversation_for_user(
        db, conversation_id=conversation_id, user_id=user.id,
    )

    if account.status == "active":
        await enqueue_job(
            db,
            JobType.SCRAPE_CONVERSATION,
            account_id=account.id,
            payload={
                "conversation_id": conversation.id,
                "kleinanzeigen_conversation_id": conversation.kleinanzeigen_id,
            },
            priority=4,
        )

    msgs = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.sent_at.asc().nullslast(), Message.id.asc())
    )
    return msgs.scalars().all()


@router.post("/conversations/{conversation_id}/send", response_model=JobOut)
async def send_message(
    conversation_id: int,
    data: SendMessageIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation, account = await _get_conversation_for_user(
        db, conversation_id=conversation_id, user_id=user.id,
    )

    job = await enqueue_job(
        db,
        JobType.SEND_MESSAGE,
        account_id=account.id,
        payload={
            "conversation_id": conversation.id,
            "kleinanzeigen_conversation_id": conversation.kleinanzeigen_id,
            "body": data.body,
        },
        priority=2,
    )
    return job


@router.post("/conversations/{conversation_id}/mark-read")
async def mark_conversation_read(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation, _account = await _get_conversation_for_user(
        db, conversation_id=conversation_id, user_id=user.id,
    )

    await db.execute(
        update(Message)
        .where(Message.conversation_id == conversation.id)
        .values(is_read=True)
    )
    conversation.unread_count = 0
    await db.commit()

    return {"success": True}
