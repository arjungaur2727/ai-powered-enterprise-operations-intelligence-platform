"""
app/schemas/dashboard.py

Pydantic v2 response schemas for the KPI Dashboard & Analytics module.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# KPI Summary
# ---------------------------------------------------------------------------

class KPISummaryResponse(BaseModel):
    # Query metrics
    queries_today: int = 0
    queries_success_today: int = 0
    queries_failed_today: int = 0
    query_success_rate_today: float = 0.0
    avg_execution_ms_today: float | None = None

    # Upload metrics
    uploads_today: int = 0
    rows_ingested_today: int = 0
    upload_success_rate_today: float = 0.0

    # Workflow metrics
    active_workflows: int = 0
    failing_workflows: int = 0
    workflow_health_pct: float = 100.0

    # AI metrics
    ai_queries_today: int = 0
    ai_tokens_today: int = 0
    ai_execution_rate_today: float = 0.0

    # User metrics
    active_users_today: int = 0
    total_users: int = 0

    # vs-yesterday comparisons (percentage change)
    queries_vs_yesterday: float = 0.0
    uploads_vs_yesterday: float = 0.0
    ai_queries_vs_yesterday: float = 0.0


# ---------------------------------------------------------------------------
# Trend data points
# ---------------------------------------------------------------------------

class TrendDataPoint(BaseModel):
    date: str
    value: float
    label: str | None = None


class DualTrendDataPoint(BaseModel):
    date: str
    value_a: float = 0.0    # success count
    value_b: float = 0.0    # failed count
    label: str | None = None


class QueryTrendResponse(BaseModel):
    data: list[DualTrendDataPoint] = []
    total_period: int = 0
    period_days: int = 14


class UploadTrendResponse(BaseModel):
    data: list[dict] = []
    total_uploads: int = 0
    total_rows: int = 0
    period_days: int = 7


# ---------------------------------------------------------------------------
# Workflow & AI analytics
# ---------------------------------------------------------------------------

class WorkflowStatusResponse(BaseModel):
    active_and_healthy: int = 0
    active_and_failing: int = 0
    inactive: int = 0
    never_run: int = 0
    total: int = 0


class AIConfidenceResponse(BaseModel):
    high: int = 0       # executed + success
    medium: int = 0     # executed + failed
    low: int = 0        # not executed
    total: int = 0
    executed_pct: float = 0.0


class TokenUsageDataPoint(BaseModel):
    date: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    session_count: int = 0


class PerformanceTrendResponse(BaseModel):
    data: list[dict] = []
    overall_avg_ms: float = 0.0
    period_days: int = 14


# ---------------------------------------------------------------------------
# Activity feed
# ---------------------------------------------------------------------------

class ActivityFeedItem(BaseModel):
    id: str
    event_type: str
    title: str
    subtitle: str
    actor_name: str | None = None
    actor_role: str | None = None
    severity: str = "info"
    timestamp: datetime
    metadata: dict | None = None


# ---------------------------------------------------------------------------
# Performance alerts
# ---------------------------------------------------------------------------

class PerformanceAlert(BaseModel):
    alert_type: str
    title: str
    description: str
    severity: str = "warning"
    metric_value: float
    threshold_value: float
    affected_count: int = 0
    recommendation: str


# ---------------------------------------------------------------------------
# Top templates & users
# ---------------------------------------------------------------------------

class TopTemplateItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    execution_count: int = 0
    success_rate: float = 0.0
    avg_execution_ms: float = 0.0
    last_executed_at: datetime | None = None
    tags: list[str] = []
    created_by_name: str | None = None


class TopUserItem(BaseModel):
    id: str
    full_name: str
    role: str
    queries_run: int = 0
    uploads_done: int = 0
    ai_queries: int = 0
    last_active_at: datetime | None = None


# ---------------------------------------------------------------------------
# KPI snapshot
# ---------------------------------------------------------------------------

class KPISnapshotCreate(BaseModel):
    metric_name: str
    metric_value: float
    metric_unit: str
    dimension: str = "daily"
    dimension_date: date
    metadata: dict | None = None
