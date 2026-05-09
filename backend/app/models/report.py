"""
app/models/report.py
ORM models: ReportTemplate, ReportSchedule, GeneratedReport
"""
from __future__ import annotations
import uuid
from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ReportTemplate(Base):
    __tablename__ = "report_templates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    report_type = Column(String(100), nullable=False)
    output_formats = Column(ARRAY(String), default=["pdf"])
    config = Column(JSONB, nullable=False, default={})
    is_active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    creator = relationship("User", foreign_keys=[created_by])
    schedules = relationship("ReportSchedule", back_populates="template", cascade="all, delete-orphan")
    generated = relationship("GeneratedReport", back_populates="template")


class ReportSchedule(Base):
    __tablename__ = "report_schedules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("report_templates.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    cron_expression = Column(String(100), nullable=False)
    timezone = Column(String(100), default="UTC")
    output_format = Column(String(20), default="pdf")
    delivery_method = Column(String(50), default="store")
    email_recipients = Column(ARRAY(String), nullable=True)
    email_subject = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_run_status = Column(String(50), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    template = relationship("ReportTemplate", back_populates="schedules")
    creator = relationship("User", foreign_keys=[created_by])
    generated = relationship("GeneratedReport", back_populates="schedule")


class GeneratedReport(Base):
    __tablename__ = "generated_reports"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("report_templates.id", ondelete="SET NULL"), nullable=True)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey("report_schedules.id", ondelete="SET NULL"), nullable=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    report_type = Column(String(100), nullable=False)
    report_name = Column(String(255), nullable=False)
    output_format = Column(String(20), nullable=False)
    file_path = Column(String(500), nullable=True)
    file_size_bytes = Column(BigInteger, default=0)
    generation_source = Column(String(50), default="manual")
    date_range_start = Column(Date, nullable=True)
    date_range_end = Column(Date, nullable=True)
    report_metadata = Column(JSONB, nullable=True)
    status = Column(String(50), default="generating")
    error_message = Column(Text, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    template = relationship("ReportTemplate", back_populates="generated")
    schedule = relationship("ReportSchedule", back_populates="generated")
    generator = relationship("User", foreign_keys=[generated_by])
