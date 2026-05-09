"""
app/models/upload.py

SQLAlchemy ORM models for data upload tracking.
- DataUpload: tracks every file ingestion job
- UploadColumnProfile: per-column statistics for each upload
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DataUpload(Base):
    """Tracks a single CSV/Excel ingestion job from parse through DB insert."""

    __tablename__ = "data_uploads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    original_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    column_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_table: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False, index=True)
    validation_errors: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    column_mapping: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    preview_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_log: Mapped[str | None] = mapped_column(Text, nullable=True)
    processing_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    uploader = relationship("User", foreign_keys=[uploaded_by])
    column_profiles = relationship(
        "UploadColumnProfile",
        back_populates="upload",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<DataUpload id={self.id} file={self.file_name!r} status={self.status!r}>"


class UploadColumnProfile(Base):
    """Per-column statistics computed during file parsing."""

    __tablename__ = "upload_column_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    upload_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("data_uploads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    column_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    data_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    null_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unique_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sample_values: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    upload = relationship("DataUpload", back_populates="column_profiles")

    def __repr__(self) -> str:
        return f"<UploadColumnProfile col={self.column_name!r} type={self.data_type!r}>"
