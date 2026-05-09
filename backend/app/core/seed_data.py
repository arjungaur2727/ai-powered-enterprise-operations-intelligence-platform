"""
app/core/seed_data.py
Seeds default report templates on first startup (idempotent).
"""
from sqlalchemy.orm import Session
from app.models.report import ReportTemplate
from app.core.logger import get_logger

logger = get_logger(__name__)

DEFAULT_TEMPLATES = [
    {
        "name": "Weekly Executive Summary",
        "description": "High-level platform KPIs for the past 7 days",
        "report_type": "executive_summary",
        "output_formats": ["pdf", "csv"],
        "config": {
            "date_range_days": 7, "include_kpi_summary": True,
            "include_query_analytics": True, "include_upload_summary": True,
            "include_workflow_status": True, "include_ai_usage": False,
            "include_top_templates": True, "branding_title": "Enterprise Operations Intelligence",
        },
    },
    {
        "name": "Query Analytics Report",
        "description": "Detailed SQL query execution statistics and trends",
        "report_type": "query_analytics",
        "output_formats": ["pdf", "csv"],
        "config": {
            "date_range_days": 14, "include_kpi_summary": True,
            "include_query_analytics": True, "include_upload_summary": False,
            "include_workflow_status": False, "include_top_templates": True,
        },
    },
    {
        "name": "Upload Activity Report",
        "description": "CSV export of all file uploads and ingestion stats",
        "report_type": "upload_report",
        "output_formats": ["csv"],
        "config": {
            "date_range_days": 30, "include_upload_summary": True,
            "include_kpi_summary": False, "include_query_analytics": False,
            "include_workflow_status": False, "include_top_templates": False,
        },
    },
    {
        "name": "Workflow Health Report",
        "description": "Scheduled workflow status and execution summary",
        "report_type": "workflow_report",
        "output_formats": ["pdf"],
        "config": {
            "date_range_days": 7, "include_workflow_status": True,
            "include_kpi_summary": True, "include_query_analytics": False,
            "include_upload_summary": False, "include_top_templates": False,
        },
    },
    {
        "name": "AI Usage Report",
        "description": "AI Query Assistant session history and token consumption",
        "report_type": "ai_usage",
        "output_formats": ["pdf", "csv"],
        "config": {
            "date_range_days": 30, "include_ai_usage": True,
            "include_kpi_summary": True, "include_query_analytics": False,
            "include_upload_summary": False, "include_workflow_status": False,
            "include_top_templates": False,
        },
    },
]


def seed_report_templates(db: Session) -> None:
    if db.query(ReportTemplate).count() > 0:
        return
    for tmpl in DEFAULT_TEMPLATES:
        db.add(ReportTemplate(**tmpl))
    db.commit()
    logger.info("Default report templates seeded (%d templates).", len(DEFAULT_TEMPLATES))


def seed_alert_rules(db: Session) -> None:
    from app.models.alert import AlertRule
    if db.query(AlertRule).count() > 0:
        return
    rules = [
        AlertRule(name="High Query Failure Rate", metric="query_failure_rate",
                  operator="gt", threshold_value=20.0, window_minutes=60,
                  severity="critical", cooldown_minutes=120,
                  notify_roles=["admin", "manager"],
                  description="Fires when >20% of queries fail in the last 60 minutes"),
        AlertRule(name="Slow Query Performance", metric="avg_execution_ms",
                  operator="gt", threshold_value=5000.0, window_minutes=30,
                  severity="warning", cooldown_minutes=180,
                  notify_roles=["admin", "manager"],
                  description="Fires when average query time exceeds 5 seconds"),
        AlertRule(name="Upload Failure Spike", metric="upload_failure_rate",
                  operator="gt", threshold_value=25.0, window_minutes=60,
                  severity="warning", cooldown_minutes=120,
                  notify_roles=["admin", "manager"],
                  description="Fires when >25% of file uploads fail"),
        AlertRule(name="Workflows Repeatedly Failing", metric="workflow_failure_count",
                  operator="gte", threshold_value=2.0, window_minutes=1440,
                  severity="critical", cooldown_minutes=480,
                  notify_roles=["admin", "manager"],
                  description="Fires when 2+ active workflows have failed multiple times"),
        AlertRule(name="Platform Inactivity", metric="no_activity_hours",
                  operator="gt", threshold_value=12.0, window_minutes=1440,
                  severity="info", cooldown_minutes=720,
                  notify_roles=["admin"],
                  description="Fires when no platform activity for 12+ hours"),
        AlertRule(name="Daily AI Token Limit", metric="ai_token_daily_limit",
                  operator="gt", threshold_value=80000.0, window_minutes=1440,
                  severity="warning", cooldown_minutes=1440,
                  notify_roles=["admin"],
                  description="Fires when daily AI token usage exceeds 80,000"),
    ]
    for r in rules:
        db.add(r)
    db.commit()
    logger.info("Default alert rules seeded (%d rules).", len(rules))

