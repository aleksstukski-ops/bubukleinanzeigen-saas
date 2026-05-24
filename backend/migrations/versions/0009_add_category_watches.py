"""add category_watches table

Revision ID: 0009_add_category_watches
Revises: 0008_add_auto_reply_rules
Create Date: 2026-05-24 00:00:01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_add_category_watches"
down_revision: Union[str, None] = "0008_add_auto_reply_rules"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "category_watches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("search_query", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=True),
        sa.Column("notify_push", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_seen_listing_ids", sa.Text(), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_category_watches_user_id", "category_watches", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_category_watches_user_id", table_name="category_watches")
    op.drop_table("category_watches")
