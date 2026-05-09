"""
app/schemas/alert.py — Pydantic v2 schemas for the Alert & Notification Engine.
"""
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field


class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    metric: str = Field(..., pattern="^(query_failure_rate|avg_execution_ms|upload_failure_rate|workflow_failure_count|no_activity_hours|ai_token_daily_limit)$")
    operator: str = Field(..., pattern="^(gt|lt|gte|lte|eq)$")
    threshold_value: float
    window_minutes: int = Field(60, ge=5, le=1440)
    severity: str = Field(..., pattern="^(info|warning|critical)$")
    cooldown_minutes: int = Field(60, ge=5, le=1440)
    notify_roles: list[str] = ["admin", "manager"]


class AlertRuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    threshold_value: float | None = None
    window_minutes: int | None = None
    severity: str | None = None
    cooldown_minutes: int | None = None
    notify_roles: list[str] | None = None
    is_active: bool | None = None


class AlertRuleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    metric: str
    metric_label: str
    operator: str
    operator_label: str
    threshold_value: float
    threshold_display: str
    window_minutes: int
    severity: str
    is_active: bool
    cooldown_minutes: int
    notify_roles: list[str] = []
    created_by_name: str | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class AlertResponse(BaseModel):
    id: str
    alert_type: str
    alert_type_label: str
    title: str
    message: str
    severity: str
    source_entity_type: str | None = None
    source_entity_id: str | None = None
    metric_value: float | None = None
    threshold_value: float | None = None
    is_read: bool = False
    is_resolved: bool = False
    resolved_by_name: str | None = None
    resolved_at: datetime | None = None
    resolution_note: str | None = None
    email_sent: bool = False
    triggered_at: datetime
    time_ago: str = ""
    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    alerts: list[AlertResponse]
    total: int
    unread_count: int
    critical_count: int
    warning_count: int


class UnreadCountResponse(BaseModel):
    count: int
    critical: int
    warning: int
    info: int


class ResolveAlertRequest(BaseModel):
    resolution_note: str | None = None


class CreateManualAlertRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    message: str = Field(..., min_length=10)
    severity: str = Field(..., pattern="^(info|warning|critical)$")
    alert_type: str = "manual"
    notify_users: bool = True


class NotificationLogResponse(BaseModel):
    id: str
    alert_id: str | None = None
    alert_title: str | None = None
    recipient_email: str
    recipient_name: str | None = None
    subject: str | None = None
    delivery_status: str
    error_message: str | None = None
    sent_at: datetime | None = None
    created_at: datetime
    model_config = {"from_attributes": True}


class TestEmailRequest(BaseModel):
    recipient_email: str
    subject: str = "Test Alert — Enterprise Ops Intelligence"
