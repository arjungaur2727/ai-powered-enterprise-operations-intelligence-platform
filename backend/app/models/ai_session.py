"""
app/models/ai_session.py

ORM models for the AI Query Assistant module.
  • AIQuerySession  — one record per NL → SQL interaction
  • SchemaCache     — cached DB schema to avoid repeated introspection
"""

import uuid

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Integer, SmallInteger,
    String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.schema import ForeignKey

from app.database import Base


class AIQuerySession(Base):
    """Persists each natural-language → SQL → execution cycle."""

    __tablename__ = "ai_query_sessions"

    # ------------------------------------------------------------------
    # Identity
    # ------------------------------------------------------------------
    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    session_group_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    turn_number = Column(Integer, nullable=False, default=1)

    # ------------------------------------------------------------------
    # Input
    # ------------------------------------------------------------------
    natural_language = Column(Text, nullable=False)
    schema_context_used = Column(Text, nullable=True)

    # ------------------------------------------------------------------
    # AI Output
    # ------------------------------------------------------------------
    generated_sql = Column(Text, nullable=True)
    explanation = Column(Text, nullable=True)
    model_used = Column(String(50), nullable=True)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    generation_ms = Column(Integer, nullable=True)
    confidence = Column(String(20), nullable=True)           # high | medium | low
    tables_referenced = Column(JSONB, nullable=True)          # list[str]
    warnings = Column(JSONB, nullable=True)                   # list[str]

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------
    was_executed = Column(Boolean, nullable=False, default=False)
    execution_status = Column(String(50), nullable=True)      # success | failed | skipped
    row_count = Column(Integer, nullable=False, default=0)
    execution_ms = Column(Integer, nullable=True)
    result_snapshot = Column(JSONB, nullable=True)
    result_columns = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Save to template
    # ------------------------------------------------------------------
    saved_as_template = Column(Boolean, nullable=False, default=False)
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sql_templates.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ------------------------------------------------------------------
    # User feedback
    # ------------------------------------------------------------------
    user_rating = Column(SmallInteger, nullable=True)         # 1–5
    user_feedback = Column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Audit
    # ------------------------------------------------------------------
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # ------------------------------------------------------------------
    # Relationships
    # ------------------------------------------------------------------
    user = relationship("User", foreign_keys=[user_id])
    template = relationship("SQLTemplate", foreign_keys=[template_id])


class SchemaCache(Base):
    """Cached PostgreSQL schema representation for GPT prompt injection."""

    __tablename__ = "schema_cache"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    cache_key = Column(String(255), unique=True, nullable=False, index=True)
    schema_json = Column(JSONB, nullable=False)
    schema_text = Column(Text, nullable=False)
    table_count = Column(Integer, nullable=False, default=0)
    column_count = Column(Integer, nullable=False, default=0)
    refreshed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)
