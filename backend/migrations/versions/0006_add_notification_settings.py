"""add notification settings to users

Revision ID: 0006_add_notification_settings
Revises: 0005_add_listing_stats
Create Date: 2026-04-20 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_add_notification_settings"
down_revision: Union[str, None] = "0005_add_listing_stats"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("notify_push_new_message", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("users", sa.Column("notify_email_new_message", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("users", "notify_email_new_message")
    op.drop_column("users", "notify_push_new_message")
