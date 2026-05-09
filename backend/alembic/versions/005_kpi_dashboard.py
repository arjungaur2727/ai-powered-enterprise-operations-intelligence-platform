"""Add kpi_snapshots table

Revision ID: 005_kpi_dashboard
Revises: 004_ai_engine
Create Date: 2025-01-05 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "005_kpi_dashboard"
down_revision: Union[str, None] = "004_ai_engine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kpi_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("metric_name", sa.String(255), nullable=False),
        sa.Column("metric_value", sa.Numeric(15, 4), nullable=False),
        sa.Column("metric_unit", sa.String(50), nullable=True),
        sa.Column("dimension", sa.String(100), nullable=True),
        sa.Column("dimension_date", sa.Date(), nullable=False),
        sa.Column("extra_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_kpi_metric_date", "kpi_snapshots", ["metric_name", "dimension_date"])


def downgrade() -> None:
    op.drop_table("kpi_snapshots")
