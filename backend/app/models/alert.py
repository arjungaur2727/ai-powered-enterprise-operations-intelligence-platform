"""
app/models/alert.py
ORM models: AlertRule, Alert, AlertRead, NotificationLog
"""
from __future__ import annotations
import uuid
from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship
from app.database import Base


class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    metric = Column(String(100), nullable=False)
    operator = Column(String(20), nullable=False)
    threshold_value = Column(Numeric(15, 4), nullable=False)
    window_minutes = Column(Integer, default=60)
    severity = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    cooldown_minutes = Column(Integer, default=60)
    notify_roles = Column(ARRAY(String), server_default=text("ARRAY['admin','manager']"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    creator = relationship("User", foreign_keys=[created_by])
    alerts = relationship("Alert", back_populates="rule")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("alert_rules.id", ondelete="SET NULL"), nullable=True)
    alert_type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False)
    source_entity_type = Column(String(100), nullable=True)
    source_entity_id = Column(UUID(as_uuid=True), nullable=True)
    metric_value = Column(Numeric(15, 4), nullable=True)
    threshold_value = Column(Numeric(15, 4), nullable=True)
    is_read = Column(Boolean, default=False)
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_note = Column(Text, nullable=True)
    notified_emails = Column(ARRAY(String), nullable=True)
    email_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    rule = relationship("AlertRule", back_populates="alerts")
    resolver = relationship("User", foreign_keys=[resolved_by])
    reads = relationship("AlertRead", back_populates="alert", cascade="all, delete-orphan")
    notifications = relationship("NotificationLog", back_populates="alert")


class AlertRead(Base):
    __tablename__ = "alert_reads"
    __table_args__ = (UniqueConstraint("alert_id", "user_id", name="uq_alert_read"),)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    read_at = Column(DateTime(timezone=True), server_default=func.now())
    alert = relationship("Alert", back_populates="reads")
    user = relationship("User")


class NotificationLog(Base):
    __tablename__ = "notification_log"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True)
    recipient_email = Column(String(255), nullable=False)
    recipient_name = Column(String(255), nullable=True)
    subject = Column(String(500), nullable=True)
    delivery_status = Column(String(50), default="pending")
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    alert = relationship("Alert", back_populates="notifications")
