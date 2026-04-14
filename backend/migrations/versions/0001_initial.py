"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-14 00:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("is_active", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("is_admin", sa.Boolean, server_default=sa.false(), nullable=False),
        sa.Column("plan", sa.String(32), server_default="free", nullable=False),
        sa.Column("stripe_customer_id", sa.String(255)),
        sa.Column("subscription_status", sa.String(32)),
        sa.Column("subscription_expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_stripe_customer_id", "users", ["stripe_customer_id"])

    # --- kleinanzeigen_accounts ---
    op.create_table(
        "kleinanzeigen_accounts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("kleinanzeigen_user_name", sa.String(255)),
        sa.Column("kleinanzeigen_user_id", sa.String(64)),
        sa.Column("session_encrypted", sa.Text),
        sa.Column("session_updated_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(32), server_default="pending_login", nullable=False),
        sa.Column("is_enabled", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("last_scraped_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ka_accounts_user_id", "kleinanzeigen_accounts", ["user_id"])
    op.create_index("ix_ka_accounts_ka_user_id", "kleinanzeigen_accounts", ["kleinanzeigen_user_id"])

    # --- listings ---
    op.create_table(
        "listings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kleinanzeigen_id", sa.String(32), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("price", sa.String(64)),
        sa.Column("price_type", sa.String(32)),
        sa.Column("category", sa.String(255)),
        sa.Column("description", sa.Text),
        sa.Column("location", sa.String(255)),
        sa.Column("image_url", sa.String(1000)),
        sa.Column("url", sa.String(1000)),
        sa.Column("view_count", sa.Integer),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean, server_default=sa.true(), nullable=False),
        sa.Column("last_scraped_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("account_id", "kleinanzeigen_id", name="uq_listing_ka_id"),
    )
    op.create_index("ix_listings_account_id", "listings", ["account_id"])
    op.create_index("ix_listings_kleinanzeigen_id", "listings", ["kleinanzeigen_id"])
    op.create_index("ix_listings_account_active", "listings", ["account_id", "is_active"])

    # --- conversations ---
    op.create_table(
        "conversations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kleinanzeigen_id", sa.String(64), nullable=False),
        sa.Column("listing_kleinanzeigen_id", sa.String(32)),
        sa.Column("partner_name", sa.String(255)),
        sa.Column("subject", sa.String(500)),
        sa.Column("last_message_preview", sa.String(500)),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.Column("unread_count", sa.Integer, server_default="0", nullable=False),
        sa.Column("is_archived", sa.Boolean, server_default=sa.false(), nullable=False),
        sa.Column("last_scraped_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("account_id", "kleinanzeigen_id", name="uq_conv_ka_id"),
    )
    op.create_index("ix_conv_account_id", "conversations", ["account_id"])
    op.create_index("ix_conv_kleinanzeigen_id", "conversations", ["kleinanzeigen_id"])
    op.create_index("ix_conv_listing_ka_id", "conversations", ["listing_kleinanzeigen_id"])

    # --- messages ---
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("conversation_id", sa.Integer, sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kleinanzeigen_id", sa.String(64), nullable=False),
        sa.Column("direction", sa.String(16), nullable=False),
        sa.Column("sender_name", sa.String(255)),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("is_read", sa.Boolean, server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("conversation_id", "kleinanzeigen_id", name="uq_msg_ka_id"),
    )
    op.create_index("ix_msg_conversation_id", "messages", ["conversation_id"])

    # --- jobs ---
    op.create_table(
        "jobs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("account_id", sa.Integer, sa.ForeignKey("kleinanzeigen_accounts.id", ondelete="CASCADE")),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), server_default="pending", nullable=False),
        sa.Column("priority", sa.Integer, server_default="5", nullable=False),
        sa.Column("payload", postgresql.JSONB, server_default="{}", nullable=False),
        sa.Column("result", postgresql.JSONB),
        sa.Column("error_message", sa.Text),
        sa.Column("screenshot_path", sa.String(500)),
        sa.Column("attempts", sa.Integer, server_default="0", nullable=False),
        sa.Column("max_attempts", sa.Integer, server_default="3", nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_jobs_account_id", "jobs", ["account_id"])
    op.create_index("ix_jobs_type", "jobs", ["type"])
    op.create_index("ix_jobs_status", "jobs", ["status"])


def downgrade() -> None:
    op.drop_table("jobs")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_table("listings")
    op.drop_table("kleinanzeigen_accounts")
    op.drop_table("users")
