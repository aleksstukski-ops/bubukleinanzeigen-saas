from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (
    BlockedPartner,
    Conversation,
    JobType,
    KleinanzeigenAccount,
    Message,
    MessageTemplate,
    User,
)
from app.schemas.resources import (
    BlockedPartnerIn,
    BlockedPartnerOut,
    ConversationOut,
    ConversationUpdateIn,
    JobOut,
    MessageOut,
    MessageTemplateIn,
    MessageTemplateOut,
    SendMessageIn,
)
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/messages", tags=["messages"])
STALE_SECONDS = 120


@router.get("/unread-summary")
async def unread_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Total unread message count across all of user's KA accounts. Lightweight (one COUNT)."""
    result = await db.execute(
        select(func.coalesce(func.sum(Conversation.unread_count), 0))
        .join(KleinanzeigenAccount, KleinanzeigenAccount.id == Conversation.account_id)
        .where(
            KleinanzeigenAccount.user_id == user.id,
            Conversation.is_spam.is_(False),
            Conversation.is_archived.is_(False),
        )
    )
    total = int(result.scalar() or 0)
    return {"total_unread": total}


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
    view: str = Query("inbox", pattern="^(inbox|archive|spam|all)$"),
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

    if view == "inbox":
        query = query.where(
            Conversation.is_archived.is_(False),
            Conversation.is_spam.is_(False),
        )
    elif view == "archive":
        query = query.where(Conversation.is_archived.is_(True), Conversation.is_spam.is_(False))
    elif view == "spam":
        query = query.where(Conversation.is_spam.is_(True))

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


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: int,
    data: ConversationUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive/unarchive, flag as spam, or attach a private note."""
    conversation, _account = await _get_conversation_for_user(
        db, conversation_id=conversation_id, user_id=user.id,
    )
    if data.is_archived is not None:
        conversation.is_archived = data.is_archived
    if data.is_spam is not None:
        conversation.is_spam = data.is_spam
    if data.note is not None:
        conversation.note = data.note or None
    await db.commit()
    await db.refresh(conversation)
    return conversation


# --- Reply templates ------------------------------------------------------

@router.get("/templates", response_model=list[MessageTemplateOut])
async def list_message_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MessageTemplate)
        .where(MessageTemplate.user_id == user.id)
        .order_by(MessageTemplate.name)
    )
    return result.scalars().all()


@router.post("/templates", response_model=MessageTemplateOut, status_code=201)
async def create_message_template(
    data: MessageTemplateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = MessageTemplate(user_id=user.id, name=data.name.strip(), body=data.body)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put("/templates/{template_id}", response_model=MessageTemplateOut)
async def update_message_template(
    template_id: int,
    data: MessageTemplateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MessageTemplate).where(
            MessageTemplate.id == template_id,
            MessageTemplate.user_id == user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")
    template.name = data.name.strip()
    template.body = data.body
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/templates/{template_id}", status_code=204)
async def delete_message_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MessageTemplate).where(
            MessageTemplate.id == template_id,
            MessageTemplate.user_id == user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")
    await db.delete(template)
    await db.commit()


# --- Blocklist ------------------------------------------------------------

@router.get("/blocklist", response_model=list[BlockedPartnerOut])
async def list_blocked_partners(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BlockedPartner)
        .where(BlockedPartner.user_id == user.id)
        .order_by(BlockedPartner.partner_name)
    )
    return result.scalars().all()


@router.post("/blocklist", response_model=BlockedPartnerOut, status_code=201)
async def block_partner(
    data: BlockedPartnerIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    name = data.partner_name.strip()
    existing = await db.execute(
        select(BlockedPartner).where(
            BlockedPartner.user_id == user.id,
            BlockedPartner.partner_name == name,
        )
    )
    entry = existing.scalar_one_or_none()
    if entry is None:
        entry = BlockedPartner(user_id=user.id, partner_name=name)
        db.add(entry)

    # Flag all existing conversations with this partner as spam right away
    await db.execute(
        update(Conversation)
        .where(
            Conversation.partner_name == name,
            Conversation.account_id.in_(
                select(KleinanzeigenAccount.id).where(KleinanzeigenAccount.user_id == user.id)
            ),
        )
        .values(is_spam=True)
    )
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/blocklist/{entry_id}", status_code=204)
async def unblock_partner(
    entry_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BlockedPartner).where(
            BlockedPartner.id == entry_id,
            BlockedPartner.user_id == user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    await db.delete(entry)
    await db.commit()
