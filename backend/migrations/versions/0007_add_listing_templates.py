"""add listing_templates table

Revision ID: 0007_add_listing_templates
Revises: 0006_add_notification_settings
Create Date: 2026-05-22 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_add_listing_templates"
down_revision: Union[str, None] = "0006_add_notification_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "listing_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.String(length=64), nullable=True),
        sa.Column("category_id", sa.String(length=64), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_listing_templates_user_id", "listing_templates", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_listing_templates_user_id", table_name="listing_templates")
    op.drop_table("listing_templates")
