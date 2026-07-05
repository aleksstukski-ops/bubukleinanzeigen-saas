"""add sales pipeline columns and message tools tables

Revision ID: 0012_add_sales_and_message_tools
Revises: 0011_add_posting_scheduler
Create Date: 2026-07-05 14:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012_add_sales_and_message_tools"
down_revision: Union[str, None] = "0011_add_posting_scheduler"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Sales pipeline on listings
    op.add_column("listings", sa.Column("sale_status", sa.String(length=32), nullable=True))
    op.add_column("listings", sa.Column("sold_price", sa.String(length=64), nullable=True))
    op.add_column("listings", sa.Column("buyer_name", sa.String(length=255), nullable=True))
    op.add_column("listings", sa.Column("sale_note", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("sold_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_listings_sale_status", "listings", ["sale_status"])

    # Inbox tools on conversations
    op.add_column(
        "conversations",
        sa.Column("is_spam", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("conversations", sa.Column("note", sa.Text(), nullable=True))

    op.create_table(
        "message_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_message_templates_user_id", "message_templates", ["user_id"])

    op.create_table(
        "blocked_partners",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("partner_name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "partner_name", name="uq_blocked_partner"),
    )
    op.create_index("ix_blocked_partners_user_id", "blocked_partners", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_blocked_partners_user_id", table_name="blocked_partners")
    op.drop_table("blocked_partners")
    op.drop_index("ix_message_templates_user_id", table_name="message_templates")
    op.drop_table("message_templates")
    op.drop_column("conversations", "note")
    op.drop_column("conversations", "is_spam")
    op.drop_index("ix_listings_sale_status", table_name="listings")
    op.drop_column("listings", "sold_at")
    op.drop_column("listings", "sale_note")
    op.drop_column("listings", "buyer_name")
    op.drop_column("listings", "sold_price")
    op.drop_column("listings", "sale_status")
