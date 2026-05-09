"""Add ai_query_sessions and schema_cache tables

Revision ID: 004_ai_engine
Revises: 003_sql_engine
Create Date: 2025-01-04 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "004_ai_engine"
down_revision: Union[str, None] = "003_sql_engine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --------------------------------------------------------- schema_cache
    op.create_table(
        "schema_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cache_key", sa.String(255), nullable=False),
        sa.Column("schema_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("schema_text", sa.Text(), nullable=False),
        sa.Column("table_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("column_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cache_key"),
    )
    op.create_index(op.f("ix_schema_cache_cache_key"), "schema_cache", ["cache_key"])

    # ---------------------------------------------------- ai_query_sessions
    op.create_table(
        "ai_query_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("session_group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("turn_number", sa.Integer(), nullable=False, server_default="1"),
        # Input
        sa.Column("natural_language", sa.Text(), nullable=False),
        sa.Column("schema_context_used", sa.Text(), nullable=True),
        # AI Output
        sa.Column("generated_sql", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("model_used", sa.String(50), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("generation_ms", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.String(20), nullable=True),
        sa.Column("tables_referenced", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("warnings", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        # Execution
        sa.Column("was_executed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("execution_status", sa.String(50), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("execution_ms", sa.Integer(), nullable=True),
        sa.Column("result_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("result_columns", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        # Save
        sa.Column("saved_as_template", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Feedback
        sa.Column("user_rating", sa.SmallInteger(), nullable=True),
        sa.Column("user_feedback", sa.Text(), nullable=True),
        # Audit
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        # Constraints
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["template_id"], ["sql_templates.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_sessions_user", "ai_query_sessions", ["user_id", "created_at"])
    op.create_index("ix_ai_sessions_group", "ai_query_sessions", ["session_group_id", "turn_number"])
    op.create_index(op.f("ix_ai_query_sessions_session_group_id"), "ai_query_sessions", ["session_group_id"])


def downgrade() -> None:
    op.drop_table("ai_query_sessions")
    op.drop_table("schema_cache")
