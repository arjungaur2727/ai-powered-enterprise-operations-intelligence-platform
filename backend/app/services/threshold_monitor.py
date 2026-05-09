"""
app/services/threshold_monitor.py
Evaluates all active alert rules against live platform metrics every 15 minutes.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.models.alert import AlertRule
from app.services.alert_service import AlertService, METRIC_LABELS

logger = get_logger(__name__)


def _evaluate_condition(value: float, operator: str, threshold: float) -> bool:
    return {
        "gt":  value > threshold,
        "lt":  value < threshold,
        "gte": value >= threshold,
        "lte": value <= threshold,
        "eq":  value == threshold,
    }.get(operator, False)


def _build_alert_message(metric: str, value: float, threshold: float, operator: str, window_minutes: int) -> str:
    messages = {
        "query_failure_rate":
            f"Query failure rate is {value:.1f}% over the last {window_minutes} min "
            f"(threshold: {threshold:.0f}%). {int(value)}% of recent queries have failed.",
        "avg_execution_ms":
            f"Average query execution time is {value:.0f}ms over the last {window_minutes} min "
            f"(threshold: {threshold:.0f}ms). Queries may be running slow or the DB is under load.",
        "upload_failure_rate":
            f"Upload failure rate is {value:.1f}% over the last {window_minutes} min "
            f"(threshold: {threshold:.0f}%). Recent file imports are experiencing errors.",
        "workflow_failure_count":
            f"{int(value)} active workflow(s) have failed 2+ times. "
            f"These workflows may need to be reviewed and repaired.",
        "no_activity_hours":
            f"No platform activity recorded for {value:.1f} hours. "
            f"Verify the system is operational and users can access the platform.",
        "ai_token_daily_limit":
            f"Daily AI token usage is {int(value):,} tokens (limit: {int(threshold):,}). "
            f"Consider reviewing AI usage patterns or increasing the daily limit.",
    }
    return messages.get(metric, f"Metric '{metric}' breached threshold: {value} {operator} {threshold}.")


def _fetch_metric_value(db: Session, metric: str, window_minutes: int) -> float | None:
    window_start = datetime.utcnow() - timedelta(minutes=window_minutes)
    try:
        if metric == "query_failure_rate":
            row = db.execute(text("""
                SELECT ROUND(COUNT(*) FILTER (WHERE status='failed')::NUMERIC
                       / NULLIF(COUNT(*), 0) * 100, 2) AS rate
                FROM query_history WHERE executed_at >= :ws
            """), {"ws": window_start}).fetchone()
            return float(row[0]) if row and row[0] is not None else 0.0

        if metric == "avg_execution_ms":
            row = db.execute(text("""
                SELECT ROUND(AVG(execution_ms), 0) AS avg_ms
                FROM query_history WHERE status='success' AND executed_at >= :ws
            """), {"ws": window_start}).fetchone()
            return float(row[0]) if row and row[0] is not None else 0.0

        if metric == "upload_failure_rate":
            row = db.execute(text("""
                SELECT ROUND(COUNT(*) FILTER (WHERE status='failed')::NUMERIC
                       / NULLIF(COUNT(*), 0) * 100, 2) AS rate
                FROM data_uploads WHERE created_at >= :ws
            """), {"ws": window_start}).fetchone()
            return float(row[0]) if row and row[0] is not None else 0.0

        if metric == "workflow_failure_count":
            row = db.execute(text("""
                SELECT COUNT(*) AS cnt FROM scheduled_workflows
                WHERE failure_count >= 2 AND is_active = TRUE
            """)).fetchone()
            return float(row[0]) if row else 0.0

        if metric == "no_activity_hours":
            row = db.execute(text("""
                SELECT EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) / 3600 AS hours_since
                FROM audit_logs
            """)).fetchone()
            return float(row[0]) if row and row[0] is not None else 0.0

        if metric == "ai_token_daily_limit":
            row = db.execute(text("""
                SELECT COALESCE(SUM(total_tokens), 0) AS tokens
                FROM ai_query_sessions WHERE DATE(created_at) = CURRENT_DATE
            """)).fetchone()
            return float(row[0]) if row else 0.0

    except Exception as exc:
        logger.error("Failed to fetch metric '%s': %s", metric, exc)
    return None


class ThresholdMonitor:
    def __init__(self):
        self.alert_service = AlertService()
        self.logger = get_logger(__name__)

    def run_checks(self, db: Session) -> int:
        rules = db.query(AlertRule).filter(AlertRule.is_active == True).all()
        triggered = 0
        for rule in rules:
            try:
                value = _fetch_metric_value(db, rule.metric, rule.window_minutes)
                if value is None:
                    logger.warning("Could not fetch metric: %s", rule.metric)
                    continue
                breached = _evaluate_condition(value, rule.operator, float(rule.threshold_value))
                if breached:
                    msg = _build_alert_message(
                        rule.metric, value, float(rule.threshold_value),
                        rule.operator, rule.window_minutes,
                    )
                    alert = self.alert_service.create_alert(
                        db=db, alert_type="threshold_breach",
                        title=f"{METRIC_LABELS.get(rule.metric, rule.metric)} Alert: {rule.name}",
                        message=msg, severity=rule.severity, rule_id=rule.id,
                        metric_value=value, threshold_value=float(rule.threshold_value),
                        notify_roles=rule.notify_roles or ["admin", "manager"],
                        send_email=rule.severity in ["warning", "critical"],
                    )
                    if alert:
                        triggered += 1
                        logger.warning(
                            "THRESHOLD BREACHED: %s (%s=%s %s %s)",
                            rule.name, rule.metric, value, rule.operator, rule.threshold_value,
                        )
                else:
                    logger.debug("Rule OK: %s (%s=%s)", rule.name, rule.metric, value)
            except Exception as exc:
                logger.error("Error checking rule '%s': %s", rule.name, exc)
        logger.info(
            "Threshold check complete: %d alerts triggered, %d rules evaluated",
            triggered, len(rules),
        )
        return triggered


threshold_monitor = ThresholdMonitor()
