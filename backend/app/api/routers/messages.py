from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Conversation, JobType, KleinanzeigenAccount, Message, User
from app.schemas.resources import ConversationOut, JobOut, MessageOut, SendMessageIn
from app.services.jobs import enqueue_job

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    account_id: int | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Conversation).join(KleinanzeigenAccount)
        .where(KleinanzeigenAccount.user_id == user.id)
        .order_by(Conversation.last_message_at.desc().nullslast())
    )
    if account_id is not None:
        query = query.where(Conversation.account_id == account_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(conversation_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation).join(KleinanzeigenAccount)
        .where(Conversation.id == conversation_id, KleinanzeigenAccount.user_id == user.id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.sent_at.asc())
    )
    return msgs.scalars().all()


@router.post("/conversations/{conversation_id}/send", response_model=JobOut)
async def send_message(conversation_id: int, data: SendMessageIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation, KleinanzeigenAccount).join(KleinanzeigenAccount)
        .where(Conversation.id == conversation_id, KleinanzeigenAccount.user_id == user.id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv, account = row
    job = await enqueue_job(db, JobType.SEND_MESSAGE, account_id=account.id,
        payload={"conversation_id": conv.id, "kleinanzeigen_conversation_id": conv.kleinanzeigen_id, "body": data.body}, priority=2)
    return job
