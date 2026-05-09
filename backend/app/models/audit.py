"""
app/models/audit.py
Audit log and system health snapshot models.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AuditLog(Base):
    """Immutable record of every significant platform action."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    entity_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    event_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=True, server_default="{}")
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), server_default="success")
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user = relationship("User", foreign_keys=[user_id])


class SystemHealthSnapshot(Base):
    """Periodic snapshots of platform health metrics."""

    __tablename__ = "system_health_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    db_connected: Mapped[bool] = mapped_column(Boolean, nullable=False)
    db_pool_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    db_pool_checked_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_users: Mapped[int | None] = mapped_column(Integer, nullable=True)
    active_sessions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    queries_last_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploads_last_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_queries_last_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    failed_jobs_last_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scheduler_running: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    scheduler_job_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_query_ms: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    error_rate_pct: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
