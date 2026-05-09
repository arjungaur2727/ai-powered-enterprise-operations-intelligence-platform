"""
app/routers/alerts.py — Alert & Notification Engine API routes.
Prefix: /api/v1/alerts
"""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.alert import Alert, AlertRule
from app.models.user import User
from app.schemas.alert import (
    AlertListResponse, AlertResponse, AlertRuleCreate, AlertRuleResponse,
    AlertRuleUpdate, CreateManualAlertRequest, NotificationLogResponse,
    ResolveAlertRequest, TestEmailRequest, UnreadCountResponse,
)
from app.services.audit_service import audit_service
from app.services.email_service import email_service

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts & Notifications"])


@router.get("", response_model=AlertListResponse)
def list_alerts(
    skip: int = 0,
    limit: int = Query(20, le=100),
    severity: str | None = None,
    alert_type: str | None = None,
    is_resolved: bool | None = None,
    is_read: bool | None = None,
    cur: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return alert_service.get_alerts(db, cur, skip, limit, severity, alert_type, is_resolved, is_read)


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(cur: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return alert_service.get_unread_count(db, cur.id)


@router.get("/rules", response_model=list[AlertRuleResponse])
def list_rules(cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    return alert_service.list_alert_rules(db)


@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
def create_rule(
    body: AlertRuleCreate,
    cur: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    result = alert_service.create_alert_rule(db, body, cur.id)
    try:
        audit_service.write_log(
            db, action="ALERT_RULE_CREATED", entity_type="alert_rule",
            entity_id=result.id, event_metadata={"name": body.name}
        )
    except Exception:
        pass
    return result


@router.put("/rules/{rule_id}", response_model=AlertRuleResponse)
def update_rule(
    rule_id: str,
    body: AlertRuleUpdate,
    cur: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return alert_service.update_alert_rule(db, uuid.UUID(rule_id), body)


@router.patch("/rules/{rule_id}/toggle", response_model=AlertRuleResponse)
def toggle_rule(
    rule_id: str,
    cur: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.is_active = not rule.is_active
    db.commit()
    db.refresh(rule)
    return _rule_to_response(rule)


@router.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: str,
    cur: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    rule = db.query(AlertRule).filter(AlertRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.is_active = False
    db.commit()
    return {"message": "Alert rule deactivated"}


@router.get("/notifications", response_model=list[NotificationLogResponse])
def list_notifications(
    skip: int = 0,
    limit: int = Query(50, le=200),
    delivery_status: str | None = None,
    cur: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return alert_service.get_notification_logs(db, skip, limit, delivery_status)


@router.post("/test-email")
def test_email(
    body: TestEmailRequest,
    cur: User = Depends(require_role("admin")),
):
    if not email_service._is_email_configured():
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Email not configured",
                "hint": "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD in .env",
            },
        )
    success = email_service.send_test_email(body.recipient_email)
    if not success:
        raise HTTPException(500, "Failed to send test email — check SMTP credentials")
    return {"message": "Test email sent", "recipient": body.recipient_email}


@router.post("/manual", response_model=AlertResponse, status_code=201)
def create_manual_alert(
    body: CreateManualAlertRequest,
    cur: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    roles = ["admin", "manager"] if body.notify_users else []
    send = body.notify_users and body.severity != "info"
    result = alert_service.create_alert(
        db=db, alert_type=body.alert_type, title=body.title,
        message=body.message, severity=body.severity,
        notify_roles=roles, send_email=send,
    )
    try:
        audit_service.write_log(
            db, action="MANUAL_ALERT_CREATED", entity_type="alert",
            entity_id=result.id, user_id=cur.id,
            event_metadata={"title": body.title, "severity": body.severity}
        )
    except Exception:
        pass
    return _alert_to_response(result, False)


@router.post("/mark-all-read")
def mark_all_read(cur: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = alert_service.mark_all_read(db, cur.id)
    return {"message": f"Marked {count} alerts as read"}


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(
    alert_id: str,
    cur: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(404, "Alert not found")
    # Auto-mark as read on view
    alert_service.mark_read(db, uuid.UUID(alert_id), cur.id)
    from app.models.alert import AlertRead
    is_read = db.query(AlertRead).filter(
        AlertRead.alert_id == alert_id, AlertRead.user_id == cur.id
    ).count() > 0
    return _alert_to_response(a, is_read)


@router.patch("/{alert_id}/read")
def mark_read(alert_id: str, cur: User = Depends(get_current_user), db: Session = Depends(get_db)):
    alert_service.mark_read(db, uuid.UUID(alert_id), cur.id)
    return {"message": "Alert marked as read"}


@router.patch("/{alert_id}/resolve", response_model=AlertResponse)
def resolve_alert(
    alert_id: str,
    body: ResolveAlertRequest,
    cur: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    return alert_service.resolve_alert(db, uuid.UUID(alert_id), cur, body)
