"""
app/services/alert_service.py
Core alert management service: create → notify → read → resolve lifecycle.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy import and_
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.core.logger import get_logger
from app.models.alert import Alert, AlertRead, AlertRule, NotificationLog
from app.models.user import User
from app.schemas.alert import (
    AlertListResponse, AlertResponse, AlertRuleCreate, AlertRuleResponse,
    AlertRuleUpdate, ResolveAlertRequest, UnreadCountResponse,
)
from app.services.email_service import email_service

logger = get_logger(__name__)

ALERT_TYPE_LABELS = {
    "threshold_breach": "Threshold Breach",
    "workflow_failure": "Workflow Failure",
    "upload_error":     "Upload Error",
    "system_event":     "System Event",
    "manual":           "Manual Alert",
}
METRIC_LABELS = {
    "query_failure_rate":     "Query Failure Rate",
    "avg_execution_ms":       "Average Execution Time",
    "upload_failure_rate":    "Upload Failure Rate",
    "workflow_failure_count": "Workflow Failure Count",
    "no_activity_hours":      "Hours Without Activity",
    "ai_token_daily_limit":   "Daily AI Token Usage",
}
METRIC_UNITS = {
    "query_failure_rate":     "%",
    "avg_execution_ms":       "ms",
    "upload_failure_rate":    "%",
    "workflow_failure_count": "",
    "no_activity_hours":      "hrs",
    "ai_token_daily_limit":   "tokens",
}
OPERATOR_LABELS = {
    "gt": "greater than", "lt": "less than",
    "gte": "≥", "lte": "≤", "eq": "equals",
}


def _compute_time_ago(dt: datetime) -> str:
    if dt is None:
        return ""
    now = datetime.now(timezone.utc)
    aware_dt = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    delta = now - aware_dt
    s = delta.total_seconds()
    if s < 60:
        return "Just now"
    if s < 3600:
        return f"{int(s / 60)} min ago"
    if s < 86400:
        return f"{int(s / 3600)} hours ago"
    return f"{int(s / 86400)} days ago"


def _alert_to_response(alert: Alert, is_read: bool = False) -> AlertResponse:
    return AlertResponse(
        id=str(alert.id),
        alert_type=alert.alert_type,
        alert_type_label=ALERT_TYPE_LABELS.get(alert.alert_type, alert.alert_type),
        title=alert.title,
        message=alert.message,
        severity=alert.severity,
        source_entity_type=alert.source_entity_type,
        source_entity_id=str(alert.source_entity_id) if alert.source_entity_id else None,
        metric_value=float(alert.metric_value) if alert.metric_value is not None else None,
        threshold_value=float(alert.threshold_value) if alert.threshold_value is not None else None,
        is_read=is_read,
        is_resolved=alert.is_resolved or False,
        resolved_by_name=alert.resolver.full_name if alert.resolver else None,
        resolved_at=alert.resolved_at,
        resolution_note=alert.resolution_note,
        email_sent=alert.email_sent or False,
        triggered_at=alert.triggered_at,
        time_ago=_compute_time_ago(alert.triggered_at),
    )


def _rule_to_response(rule: AlertRule) -> AlertRuleResponse:
    metric = rule.metric or ""
    unit = METRIC_UNITS.get(metric, "")
    return AlertRuleResponse(
        id=str(rule.id),
        name=rule.name,
        description=rule.description,
        metric=metric,
        metric_label=METRIC_LABELS.get(metric, metric),
        operator=rule.operator,
        operator_label=OPERATOR_LABELS.get(rule.operator, rule.operator),
        threshold_value=float(rule.threshold_value),
        threshold_display=f"{float(rule.threshold_value)}{unit}",
        window_minutes=rule.window_minutes,
        severity=rule.severity,
        is_active=rule.is_active,
        cooldown_minutes=rule.cooldown_minutes,
        notify_roles=rule.notify_roles or [],
        created_by_name=rule.creator.full_name if rule.creator else None,
        created_at=rule.created_at,
    )


class AlertService:
    def __init__(self):
        self.logger = get_logger(__name__)

    def _resolve_recipients(self, db: Session, notify_roles: list[str]) -> list[tuple[str, str]]:
        users = db.query(User).filter(
            User.role.in_(notify_roles), User.is_active == True
        ).all()
        return [(u.email, u.full_name) for u in users if u.email]

    def _check_cooldown(self, db: Session, rule_id: uuid.UUID) -> bool:
        rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
        if not rule:
            return False
        cutoff = datetime.utcnow() - timedelta(minutes=rule.cooldown_minutes)
        recent = db.query(Alert).filter(
            Alert.rule_id == rule_id,
            Alert.triggered_at >= cutoff,
        ).count()
        return recent > 0

    def create_alert(
        self,
        db: Session,
        alert_type: str,
        title: str,
        message: str,
        severity: str,
        rule_id: uuid.UUID | None = None,
        source_entity_type: str | None = None,
        source_entity_id: uuid.UUID | None = None,
        metric_value: float | None = None,
        threshold_value: float | None = None,
        notify_roles: list[str] | None = None,
        send_email: bool = True,
    ) -> Alert | None:
        if notify_roles is None:
            notify_roles = ["admin", "manager"]

        if rule_id and self._check_cooldown(db, rule_id):
            logger.debug("Alert suppressed (cooldown active) for rule %s", rule_id)
            return None

        alert = Alert(
            alert_type=alert_type, title=title, message=message, severity=severity,
            rule_id=rule_id, source_entity_type=source_entity_type,
            source_entity_id=source_entity_id, metric_value=metric_value,
            threshold_value=threshold_value,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        try:
            from app.core.audit import write_audit_log
            write_audit_log(db, action="ALERT_TRIGGERED", resource_type="alert",
                            resource_id=str(alert.id),
                            metadata={"type": alert_type, "severity": severity})
        except Exception:
            pass

        if send_email:
            try:
                recipients = self._resolve_recipients(db, notify_roles)
                if recipients:
                    email_service.send_alert_email(db, alert, recipients)
            except Exception as exc:
                logger.error("Email dispatch error: %s", exc)

        logger.info("Alert created: [%s] %s", severity.upper(), title)
        return alert

    def create_workflow_failure_alert(
        self, db: Session, workflow_name: str,
        workflow_id: uuid.UUID, error_message: str, failure_count: int,
    ) -> Alert | None:
        severity = "critical" if failure_count >= 3 else "warning"
        title = f"Workflow Failed: {workflow_name}"
        msg = (
            f"The scheduled SQL workflow '{workflow_name}' has failed (failure #{failure_count}). "
            f"Error: {error_message[:200]}. "
            f"{'This workflow has been auto-disabled after 3 failures.' if failure_count >= 3 else 'Please review and fix the workflow.'}"
        )
        return self.create_alert(
            db=db, alert_type="workflow_failure", title=title,
            message=msg, severity=severity,
            source_entity_type="workflow", source_entity_id=workflow_id,
            notify_roles=["admin", "manager"], send_email=True,
        )

    def create_upload_error_alert(
        self, db: Session, file_name: str,
        upload_id: uuid.UUID, error_message: str,
    ) -> Alert | None:
        return self.create_alert(
            db=db, alert_type="upload_error",
            title=f"Upload Failed: {file_name}",
            message=f"File '{file_name}' failed to import. Error: {error_message[:300]}",
            severity="warning",
            source_entity_type="upload", source_entity_id=upload_id,
            notify_roles=["admin", "manager"], send_email=False,
        )

    def _get_user_read_ids(self, db: Session, user_id: uuid.UUID):
        return db.query(AlertRead.alert_id).filter(AlertRead.user_id == user_id).subquery()

    def get_alerts(
        self, db: Session, current_user,
        skip: int, limit: int,
        severity: str | None, alert_type: str | None,
        is_resolved: bool | None, is_read: bool | None,
    ) -> AlertListResponse:
        q = db.query(Alert)
        if current_user.role == "analyst":
            q = q.filter(Alert.severity.in_(["info", "warning"]))
        if severity:
            q = q.filter(Alert.severity == severity)
        if alert_type:
            q = q.filter(Alert.alert_type == alert_type)
        if is_resolved is not None:
            q = q.filter(Alert.is_resolved == is_resolved)

        read_ids_sq = self._get_user_read_ids(db, current_user.id)
        if is_read is False:
            q = q.filter(Alert.id.notin_(read_ids_sq))
        elif is_read is True:
            q = q.filter(Alert.id.in_(read_ids_sq))

        total = q.count()
        alerts = q.order_by(Alert.triggered_at.desc()).offset(skip).limit(limit).all()

        read_ids_set = {row[0] for row in db.query(AlertRead.alert_id).filter(
            AlertRead.user_id == current_user.id,
            AlertRead.alert_id.in_([a.id for a in alerts]),
        ).all()}

        unread_count = self.get_unread_count(db, current_user.id).count
        critical_count = db.query(Alert).filter(Alert.severity == "critical", Alert.is_resolved == False).count()
        warning_count = db.query(Alert).filter(Alert.severity == "warning", Alert.is_resolved == False).count()

        return AlertListResponse(
            alerts=[_alert_to_response(a, a.id in read_ids_set) for a in alerts],
            total=total,
            unread_count=unread_count,
            critical_count=critical_count,
            warning_count=warning_count,
        )

    def get_unread_count(self, db: Session, user_id: uuid.UUID) -> UnreadCountResponse:
        read_ids_sq = db.query(AlertRead.alert_id).filter(AlertRead.user_id == user_id).subquery()
        unread_q = db.query(Alert).filter(Alert.id.notin_(read_ids_sq), Alert.is_resolved == False)
        total = unread_q.count()
        critical = unread_q.filter(Alert.severity == "critical").count()
        warning = unread_q.filter(Alert.severity == "warning").count()
        info = unread_q.filter(Alert.severity == "info").count()
        return UnreadCountResponse(count=total, critical=critical, warning=warning, info=info)

    def mark_read(self, db: Session, alert_id: uuid.UUID, user_id: uuid.UUID) -> None:
        existing = db.query(AlertRead).filter(
            AlertRead.alert_id == alert_id, AlertRead.user_id == user_id
        ).first()
        if not existing:
            db.add(AlertRead(alert_id=alert_id, user_id=user_id))
            # Also update global is_read flag
            alert = db.query(Alert).filter(Alert.id == alert_id).first()
            if alert:
                alert.is_read = True
            db.commit()

    def mark_all_read(self, db: Session, user_id: uuid.UUID) -> int:
        read_ids_sq = db.query(AlertRead.alert_id).filter(AlertRead.user_id == user_id).subquery()
        unread = db.query(Alert).filter(Alert.id.notin_(read_ids_sq)).all()
        count = len(unread)
        for alert in unread:
            db.add(AlertRead(alert_id=alert.id, user_id=user_id))
            alert.is_read = True
        db.commit()
        return count

    def resolve_alert(
        self, db: Session, alert_id: uuid.UUID,
        current_user, request: ResolveAlertRequest,
    ) -> AlertResponse:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert:
            raise HTTPException(404, "Alert not found")
        if alert.is_resolved:
            raise HTTPException(400, "Alert already resolved")
        alert.is_resolved = True
        alert.resolved_by = current_user.id
        alert.resolved_at = datetime.utcnow()
        alert.resolution_note = request.resolution_note
        db.commit()
        db.refresh(alert)
        self.mark_read(db, alert_id, current_user.id)
        try:
            from app.core.audit import write_audit_log
            write_audit_log(db, action="ALERT_RESOLVED", resource_type="alert",
                            resource_id=str(alert_id),
                            metadata={"resolved_by": str(current_user.id)})
        except Exception:
            pass
        logger.info("Alert resolved by %s: %s", current_user.email, alert.title)
        return _alert_to_response(alert, True)

    def create_alert_rule(self, db: Session, data: AlertRuleCreate, user_id: uuid.UUID) -> AlertRuleResponse:
        rule = AlertRule(
            name=data.name, description=data.description, metric=data.metric,
            operator=data.operator, threshold_value=data.threshold_value,
            window_minutes=data.window_minutes, severity=data.severity,
            cooldown_minutes=data.cooldown_minutes, notify_roles=data.notify_roles,
            created_by=user_id,
        )
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return _rule_to_response(rule)

    def list_alert_rules(self, db: Session) -> list[AlertRuleResponse]:
        rules = db.query(AlertRule).order_by(AlertRule.created_at.desc()).all()
        return [_rule_to_response(r) for r in rules]

    def update_alert_rule(self, db: Session, rule_id: uuid.UUID, data: AlertRuleUpdate) -> AlertRuleResponse:
        rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
        if not rule:
            raise HTTPException(404, "Rule not found")
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(rule, k, v)
        db.commit()
        db.refresh(rule)
        return _rule_to_response(rule)

    def get_notification_logs(self, db: Session, skip: int, limit: int, delivery_status: str | None) -> list:
        q = db.query(NotificationLog)
        if delivery_status:
            q = q.filter(NotificationLog.delivery_status == delivery_status)
        logs = q.order_by(NotificationLog.created_at.desc()).offset(skip).limit(limit).all()
        from app.schemas.alert import NotificationLogResponse
        results = []
        for log in logs:
            title = log.alert.title if log.alert else None
            results.append(NotificationLogResponse(
                id=str(log.id), alert_id=str(log.alert_id) if log.alert_id else None,
                alert_title=title, recipient_email=log.recipient_email,
                recipient_name=log.recipient_name, subject=log.subject,
                delivery_status=log.delivery_status, error_message=log.error_message,
                sent_at=log.sent_at, created_at=log.created_at,
            ))
        return results


alert_service = AlertService()
