"""add auto_reply_rules table

Revision ID: 0008_add_auto_reply_rules
Revises: 0007_add_listing_templates
Create Date: 2026-05-24 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008_add_auto_reply_rules"
down_revision: Union[str, None] = "0007_add_listing_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auto_reply_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("trigger_text", sa.String(length=200), nullable=False),
        sa.Column("reply_text", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_auto_reply_rules_user_id", "auto_reply_rules", ["user_id"])
    op.create_index("ix_auto_reply_rules_account_id", "auto_reply_rules", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_auto_reply_rules_account_id", table_name="auto_reply_rules")
    op.drop_index("ix_auto_reply_rules_user_id", table_name="auto_reply_rules")
    op.drop_table("auto_reply_rules")
