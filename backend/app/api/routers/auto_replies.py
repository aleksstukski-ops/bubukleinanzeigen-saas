"""Auto-reply rules CRUD — user-scoped.

Matching logic (incoming message body contains trigger_text -> enqueue
SEND_MESSAGE with reply_text) is wired in the scraper dispatcher; this
router just owns the rule definitions.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import AutoReplyRule, KleinanzeigenAccount, User
from app.schemas.resources import AutoReplyRuleIn, AutoReplyRuleOut

router = APIRouter(prefix="/auto-replies", tags=["auto-replies"])


async def _assert_account_owned(db: AsyncSession, *, account_id: int | None, user_id: int) -> None:
    if account_id is None:
        return
    result = await db.execute(
        select(KleinanzeigenAccount.id).where(
            KleinanzeigenAccount.id == account_id,
            KleinanzeigenAccount.user_id == user_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Account not found")


async def _get_rule_for_user(db: AsyncSession, *, rule_id: int, user_id: int) -> AutoReplyRule:
    result = await db.execute(
        select(AutoReplyRule).where(
            AutoReplyRule.id == rule_id,
            AutoReplyRule.user_id == user_id,
        )
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(status_code=404, detail="Auto-reply rule not found")
    return rule


@router.get("", response_model=list[AutoReplyRuleOut])
async def list_rules(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutoReplyRule)
        .where(AutoReplyRule.user_id == user.id)
        .order_by(AutoReplyRule.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AutoReplyRuleOut, status_code=201)
async def create_rule(
    payload: AutoReplyRuleIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _assert_account_owned(db, account_id=payload.account_id, user_id=user.id)
    rule = AutoReplyRule(
        user_id=user.id,
        account_id=payload.account_id,
        trigger_text=payload.trigger_text,
        reply_text=payload.reply_text,
        is_active=payload.is_active,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_rule_for_user(db, rule_id=rule_id, user_id=user.id)
    await db.delete(rule)
    await db.commit()
    return None
