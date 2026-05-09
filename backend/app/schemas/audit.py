"""
app/schemas/audit.py
Pydantic v2 schemas for Audit Logs & Monitoring.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: UUID | None
    user_email: str | None
    user_role: str | None
    user_display: str
    action: str
    action_label: str
    action_category: str
    entity_type: str | None
    entity_name: str | None
    entity_id: UUID | None
    metadata: dict = Field(default_factory=dict)
    ip_address: str | None
    status: str
    status_label: str
    duration_ms: int | None
    duration_label: str | None
    error_message: str | None
    created_at: datetime
    time_ago: str

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int
    page: int
    pages: int


class AuditSummaryResponse(BaseModel):
    total_events: int
    events_today: int
    events_this_week: int
    failure_count: int
    failure_rate_pct: float
    top_actions: list[dict]
    top_users: list[dict]
    activity_by_hour: list[dict]
    activity_by_day: list[dict]


class SystemHealthResponse(BaseModel):
    status: str
    status_label: str
    db_connected: bool
    db_pool_size: int | None
    db_pool_checked_out: int | None
    total_users: int
    active_sessions: int
    queries_last_hour: int
    uploads_last_hour: int
    ai_queries_last_hour: int
    failed_jobs_last_hour: int
    scheduler_running: bool
    scheduler_job_count: int
    avg_query_ms: float | None
    error_rate_pct: float | None
    snapshot_at: datetime
    uptime_label: str


class SchedulerJobResponse(BaseModel):
    id: str
    name: str
    next_run_time: datetime | None
    next_run_label: str
    trigger: str
    is_running: bool


class UserActivitySummaryResponse(BaseModel):
    user_id: UUID
    user_email: str
    user_role: str
    total_actions: int
    last_seen: datetime | None
    last_seen_label: str
    action_breakdown: list[dict]
    recent_logs: list[AuditLogResponse]
