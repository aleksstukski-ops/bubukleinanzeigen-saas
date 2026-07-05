"""add posting_schedules and scheduled_listings tables

Revision ID: 0011_add_posting_scheduler
Revises: 0010_add_activity_log
Create Date: 2026-07-05 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0011_add_posting_scheduler"
down_revision: Union[str, None] = "0010_add_activity_log"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "posting_schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("posts_per_day", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("window_start_hour", sa.Integer(), nullable=False, server_default="9"),
        sa.Column("window_end_hour", sa.Integer(), nullable=False, server_default="18"),
        sa.Column("last_posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("posted_today", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("posted_today_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_posting_schedules_account_id", "posting_schedules", ["account_id"])

    op.create_table(
        "scheduled_listings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.String(length=64), nullable=True),
        sa.Column("category_id", sa.String(length=64), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="queued"),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_scheduled_listings_user_id", "scheduled_listings", ["user_id"])
    op.create_index("ix_scheduled_listings_account_id", "scheduled_listings", ["account_id"])
    op.create_index("ix_scheduled_listings_status", "scheduled_listings", ["status"])
    op.create_index(
        "ix_scheduled_listings_account_status", "scheduled_listings", ["account_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_scheduled_listings_account_status", table_name="scheduled_listings")
    op.drop_index("ix_scheduled_listings_status", table_name="scheduled_listings")
    op.drop_index("ix_scheduled_listings_account_id", table_name="scheduled_listings")
    op.drop_index("ix_scheduled_listings_user_id", table_name="scheduled_listings")
    op.drop_table("scheduled_listings")
    op.drop_index("ix_posting_schedules_account_id", table_name="posting_schedules")
    op.drop_table("posting_schedules")
