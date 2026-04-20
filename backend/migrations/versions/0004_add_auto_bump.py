"""add auto-bump fields to listings

Revision ID: 0004_add_auto_bump
Revises: 0003_add_push_subscriptions
Create Date: 2026-04-20 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_add_auto_bump"
down_revision: Union[str, None] = "0003_add_push_subscriptions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("listings", sa.Column("bump_interval_days", sa.Integer(), nullable=True))
    op.add_column("listings", sa.Column("next_bump_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_listings_next_bump_at", "listings", ["next_bump_at"], postgresql_where=sa.text("next_bump_at IS NOT NULL"))


def downgrade() -> None:
    op.drop_index("ix_listings_next_bump_at", table_name="listings")
    op.drop_column("listings", "next_bump_at")
    op.drop_column("listings", "bump_interval_days")
