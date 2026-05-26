"""add activity_log table

Revision ID: 0010_add_activity_log
Revises: 0009_add_category_watches
Create Date: 2026-05-26 13:45:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_add_activity_log"
down_revision: Union[str, None] = "0009_add_category_watches"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("kleinanzeigen_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("listing_id", sa.String(length=64), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_activity_log_user_id", "activity_log", ["user_id"])
    op.create_index("ix_activity_log_account_id", "activity_log", ["account_id"])
    op.create_index("ix_activity_log_listing_id", "activity_log", ["listing_id"])
    op.create_index("ix_activity_log_user_created", "activity_log", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_activity_log_user_created", table_name="activity_log")
    op.drop_index("ix_activity_log_listing_id", table_name="activity_log")
    op.drop_index("ix_activity_log_account_id", table_name="activity_log")
    op.drop_index("ix_activity_log_user_id", table_name="activity_log")
    op.drop_table("activity_log")
