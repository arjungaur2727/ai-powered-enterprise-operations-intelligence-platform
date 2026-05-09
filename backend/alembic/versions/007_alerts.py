"""Add alert_rules, alerts, alert_reads, notification_log tables

Revision ID: 007_alerts
Revises: 006_reports
Create Date: 2025-01-07 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "007_alerts"
down_revision: Union[str, None] = "006_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alert_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metric", sa.String(100), nullable=False),
        sa.Column("operator", sa.String(20), nullable=False),
        sa.Column("threshold_value", sa.Numeric(15, 4), nullable=False),
        sa.Column("window_minutes", sa.Integer(), server_default="60"),
        sa.Column("severity", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("TRUE")),
        sa.Column("cooldown_minutes", sa.Integer(), server_default="60"),
        sa.Column("notify_roles", postgresql.ARRAY(sa.String()), server_default=sa.text("ARRAY['admin','manager']")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_alert_rules_name", "alert_rules", ["name"])
    op.create_index("idx_alert_rules_active", "alert_rules", ["is_active"])

    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("alert_type", sa.String(100), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(50), nullable=False),
        sa.Column("source_entity_type", sa.String(100), nullable=True),
        sa.Column("source_entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metric_value", sa.Numeric(15, 4), nullable=True),
        sa.Column("threshold_value", sa.Numeric(15, 4), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("FALSE")),
        sa.Column("is_resolved", sa.Boolean(), server_default=sa.text("FALSE")),
        sa.Column("resolved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("notified_emails", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("email_sent", sa.Boolean(), server_default=sa.text("FALSE")),
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("triggered_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resolved_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_alerts_severity_resolved", "alerts", ["severity", "is_resolved", "triggered_at"])
    op.create_index("idx_alerts_type", "alerts", ["alert_type", "triggered_at"])
    op.create_index("idx_alerts_unread", "alerts", ["is_read", "is_resolved", "triggered_at"])

    op.create_table(
        "alert_reads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("alert_id", "user_id", name="uq_alert_read"),
    )
    op.create_index("idx_alert_reads_user", "alert_reads", ["user_id", "alert_id"])

    op.create_table(
        "notification_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recipient_email", sa.String(255), nullable=False),
        sa.Column("recipient_name", sa.String(255), nullable=True),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("delivery_status", sa.String(50), server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_notif_log_alert", "notification_log", ["alert_id"])
    op.create_index("idx_notif_log_status", "notification_log", ["delivery_status", "created_at"])


def downgrade() -> None:
    op.drop_table("notification_log")
    op.drop_table("alert_reads")
    op.drop_table("alerts")
    op.drop_table("alert_rules")
