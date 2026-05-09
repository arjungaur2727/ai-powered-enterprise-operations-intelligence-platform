"""Add data_uploads and upload_column_profiles tables

Revision ID: 002_upload_tables
Revises: 001_initial
Create Date: 2025-01-02 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "002_upload_tables"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ----------------------------------------------------------- data_uploads
    op.create_table(
        "data_uploads",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(20), nullable=False),
        sa.Column("original_size", sa.BigInteger(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("column_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("target_table", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("validation_errors", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("column_mapping", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("preview_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_log", sa.Text(), nullable=True),
        sa.Column("processing_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_data_uploads_uploaded_by"), "data_uploads", ["uploaded_by"])
    op.create_index(op.f("ix_data_uploads_status"), "data_uploads", ["status"])
    op.create_index(op.f("ix_data_uploads_created_at"), "data_uploads", ["created_at"])

    # ------------------------------------------------- upload_column_profiles
    op.create_table(
        "upload_column_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("upload_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("column_name", sa.String(255), nullable=True),
        sa.Column("data_type", sa.String(50), nullable=True),
        sa.Column("null_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("unique_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sample_values", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["upload_id"], ["data_uploads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_upload_column_profiles_upload_id"),
        "upload_column_profiles",
        ["upload_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_upload_column_profiles_upload_id"), table_name="upload_column_profiles")
    op.drop_table("upload_column_profiles")
    op.drop_index(op.f("ix_data_uploads_created_at"), table_name="data_uploads")
    op.drop_index(op.f("ix_data_uploads_status"), table_name="data_uploads")
    op.drop_index(op.f("ix_data_uploads_uploaded_by"), table_name="data_uploads")
    op.drop_table("data_uploads")
