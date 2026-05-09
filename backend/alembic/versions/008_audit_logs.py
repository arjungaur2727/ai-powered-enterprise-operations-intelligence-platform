"""Add audit_logs and system_health_snapshots tables

Revision ID: 008_audit_logs
Revises: 007_alerts
Create Date: 2025-01-08 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "008_audit_logs"
down_revision: Union[str, None] = "007_alerts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_email", sa.String(255), nullable=True),
        sa.Column("user_role", sa.String(50), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entity_name", sa.String(255), nullable=True),
        sa.Column("event_metadata", postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="success"),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_user", "audit_logs", ["user_id", sa.text("created_at DESC")])
    op.create_index("idx_audit_action", "audit_logs", ["action", sa.text("created_at DESC")])
    op.create_index("idx_audit_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("idx_audit_status", "audit_logs", ["status", sa.text("created_at DESC")])
    op.create_index("idx_audit_created", "audit_logs", [sa.text("created_at DESC")])

    # system_health_snapshots table
    op.create_table(
        "system_health_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("db_connected", sa.Boolean(), nullable=False),
        sa.Column("db_pool_size", sa.Integer(), nullable=True),
        sa.Column("db_pool_checked_out", sa.Integer(), nullable=True),
        sa.Column("total_users", sa.Integer(), nullable=True),
        sa.Column("active_sessions", sa.Integer(), nullable=True),
        sa.Column("queries_last_hour", sa.Integer(), nullable=True),
        sa.Column("uploads_last_hour", sa.Integer(), nullable=True),
        sa.Column("ai_queries_last_hour", sa.Integer(), nullable=True),
        sa.Column("failed_jobs_last_hour", sa.Integer(), nullable=True),
        sa.Column("scheduler_running", sa.Boolean(), nullable=True),
        sa.Column("scheduler_job_count", sa.Integer(), nullable=True),
        sa.Column("avg_query_ms", sa.Numeric(10, 2), nullable=True),
        sa.Column("error_rate_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_health_snapshot_at", "system_health_snapshots", [sa.text("snapshot_at DESC")])


def downgrade() -> None:
    op.drop_table("system_health_snapshots")
    op.drop_table("audit_logs")
