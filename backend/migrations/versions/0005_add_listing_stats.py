"""add listing_stats table

Revision ID: 0005_add_listing_stats
Revises: 0004_add_auto_bump
Create Date: 2026-04-20 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_add_listing_stats"
down_revision: Union[str, None] = "0004_add_auto_bump"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "listing_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("listing_id", sa.Integer(), sa.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scraped_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("view_count", sa.Integer(), nullable=True),
        sa.Column("bookmark_count", sa.Integer(), nullable=True),
    )
    op.create_index("ix_listing_stats_listing_id_scraped_at", "listing_stats", ["listing_id", "scraped_at"])


def downgrade() -> None:
    op.drop_index("ix_listing_stats_listing_id_scraped_at", table_name="listing_stats")
    op.drop_table("listing_stats")
