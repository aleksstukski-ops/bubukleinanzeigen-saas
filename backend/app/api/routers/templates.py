"""Listing-template CRUD — user-scoped, used as prefill for new listings."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import ListingTemplate, User
from app.schemas.resources import ListingTemplateIn, ListingTemplateOut

router = APIRouter(prefix="/templates", tags=["templates"])


async def _get_template_for_user(
    db: AsyncSession, *, template_id: int, user_id: int
) -> ListingTemplate:
    result = await db.execute(
        select(ListingTemplate).where(
            ListingTemplate.id == template_id,
            ListingTemplate.user_id == user_id,
        )
    )
    template = result.scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.get("", response_model=list[ListingTemplateOut])
async def list_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ListingTemplate)
        .where(ListingTemplate.user_id == user.id)
        .order_by(ListingTemplate.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ListingTemplateOut, status_code=201)
async def create_template(
    payload: ListingTemplateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = ListingTemplate(
        user_id=user.id,
        name=payload.name,
        title=payload.title,
        description=payload.description,
        price=payload.price,
        category_id=payload.category_id,
        location=payload.location,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put("/{template_id}", response_model=ListingTemplateOut)
async def update_template(
    template_id: int,
    payload: ListingTemplateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await _get_template_for_user(db, template_id=template_id, user_id=user.id)
    template.name = payload.name
    template.title = payload.title
    template.description = payload.description
    template.price = payload.price
    template.category_id = payload.category_id
    template.location = payload.location
    template.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    template = await _get_template_for_user(db, template_id=template_id, user_id=user.id)
    await db.delete(template)
    await db.commit()
    return None
