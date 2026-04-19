"""add bookmark_count to listings

Revision ID: 0002_add_bookmark_count
Revises: 0001_initial
Create Date: 2026-04-19 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_add_bookmark_count"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD COLUMN IF NOT EXISTS — column may already exist if added manually before this migration
    op.execute(
        "ALTER TABLE listings ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0"
    )


def downgrade() -> None:
    op.drop_column("listings", "bookmark_count")
