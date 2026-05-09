"""
app/services/audit_service.py
Core audit logging service.
"""

import math
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Request
from sqlalchemy import String, cast, desc, func, text
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogListResponse, AuditLogResponse, AuditSummaryResponse, UserActivitySummaryResponse

logger = get_logger(__name__)

ACTION_LABELS = {
    "AUTH_LOGIN": ("User Login", "auth"),
    "AUTH_LOGOUT": ("User Logout", "auth"),
    "AUTH_FAILED": ("Login Failed", "auth"),
    "AUTH_TOKEN_REFRESH": ("Token Refreshed", "auth"),
    "QUERY_EXECUTED": ("Query Executed", "data"),
    "QUERY_FAILED": ("Query Failed", "data"),
    "AI_QUERY_EXECUTED": ("AI Query Executed", "ai"),
    "AI_QUERY_FAILED": ("AI Query Failed", "ai"),
    "UPLOAD_SUCCESS": ("File Uploaded", "data"),
    "UPLOAD_FAILED": ("Upload Failed", "data"),
    "WORKFLOW_CREATED": ("Workflow Created", "data"),
    "WORKFLOW_UPDATED": ("Workflow Updated", "data"),
    "WORKFLOW_EXECUTED": ("Workflow Executed", "data"),
    "WORKFLOW_DELETED": ("Workflow Deleted", "data"),
    "REPORT_GENERATED": ("Report Generated", "data"),
    "REPORT_DOWNLOADED": ("Report Downloaded", "data"),
    "ALERT_TRIGGERED": ("Alert Triggered", "system"),
    "ALERT_RESOLVED": ("Alert Resolved", "system"),
    "MANUAL_ALERT_CREATED": ("Manual Alert Created", "system"),
    "ALERT_RULE_CREATED": ("Alert Rule Created", "admin"),
    "ALERT_RULE_UPDATED": ("Alert Rule Updated", "admin"),
    "USER_CREATED": ("User Created", "admin"),
    "USER_UPDATED": ("User Updated", "admin"),
    "USER_DEACTIVATED": ("User Deactivated", "admin"),
    "SYSTEM_STARTUP": ("System Started", "system"),
    "SYSTEM_HEALTH_CHECK": ("Health Check", "system"),
    "AUDIT_EXPORT": ("Audit Log Exported", "admin"),
}


class AuditService:
    def write_log(
        self,
        db: Session,
        action: str,
        status: str = "success",
        user_id: UUID | None = None,
        user_email: str | None = None,
        user_role: str | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        entity_name: str | None = None,
        event_metadata: dict = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        duration_ms: int | None = None,
        error_message: str | None = None,
    ) -> None:
        """Write an audit log entry. Non-blocking and never raises exceptions."""
        try:
            log = AuditLog(
                user_id=user_id,
                user_email=user_email,
                user_role=user_role,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                entity_name=entity_name,
                event_metadata=event_metadata or {},
                ip_address=ip_address,
                user_agent=user_agent,
                status=status,
                duration_ms=duration_ms,
                error_message=error_message,
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Audit log write failed (non-critical): {str(e)}")
            try:
                db.rollback()
            except Exception:
                pass

    def write_log_from_request(
        self, db: Session, request: Request, action: str, current_user: Any = None, **kwargs
    ) -> None:
        """Convenience method: extracts IP + user_agent from FastAPI Request."""
        ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or (request.client.host if request.client else None)
        )
        self.write_log(
            db=db,
            action=action,
            user_id=current_user.id if current_user else None,
            user_email=current_user.email if current_user else None,
            user_role=current_user.role if current_user else None,
            ip_address=ip,
            user_agent=request.headers.get("User-Agent"),
            **kwargs,
        )

    def get_audit_logs(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 50,
        action: str | None = None,
        action_category: str | None = None,
        user_id: UUID | None = None,
        entity_type: str | None = None,
        status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        search: str | None = None,
    ) -> AuditLogListResponse:
        """Paginated, filtered audit log retrieval."""
        query = db.query(AuditLog)

        if action:
            query = query.filter(AuditLog.action == action)
        if action_category:
            valid_actions = [k for k, v in ACTION_LABELS.items() if v[1] == action_category]
            query = query.filter(AuditLog.action.in_(valid_actions))
        if user_id:
            query = query.filter(AuditLog.user_id == user_id)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if status:
            query = query.filter(AuditLog.status == status)
        if date_from:
            query = query.filter(AuditLog.created_at >= date_from)
        if date_to:
            query = query.filter(AuditLog.created_at <= date_to)
        if search:
            query = query.filter(
                (AuditLog.user_email.ilike(f"%{search}%"))
                | (AuditLog.action.ilike(f"%{search}%"))
                | (AuditLog.entity_name.ilike(f"%{search}%"))
                | (cast(AuditLog.event_metadata, String).ilike(f"%{search}%"))
            )

        total = query.count()
        logs = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit).all()

        pages = math.ceil(total / limit) if limit else 1
        page = (skip // limit) + 1 if limit else 1

        return AuditLogListResponse(
            logs=[self._build_log_response(log) for log in logs],
            total=total,
            page=page,
            pages=pages,
        )

    def get_audit_summary(self, db: Session) -> AuditSummaryResponse:
        """Aggregated statistics for the admin dashboard panel."""
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)

        total_events = db.query(AuditLog).count()
        events_today = db.query(AuditLog).filter(AuditLog.created_at >= today_start).count()
        events_this_week = db.query(AuditLog).filter(AuditLog.created_at >= week_start).count()
        failure_count = db.query(AuditLog).filter(
            AuditLog.status == "failure", AuditLog.created_at >= week_start
        ).count()

        failure_rate_pct = round((failure_count / max(events_this_week, 1)) * 100, 2)

        # Top actions
        top_actions_raw = db.execute(
            text(
                "SELECT action, COUNT(*) as count FROM audit_logs WHERE created_at >= :week_start GROUP BY action ORDER BY count DESC LIMIT 8"
            ),
            {"week_start": week_start},
        ).fetchall()
        top_actions = [
            {"action": r[0], "label": ACTION_LABELS.get(r[0], (r[0], ""))[0], "count": r[1]}
            for r in top_actions_raw
        ]

        # Top users
        top_users_raw = db.execute(
            text(
                "SELECT user_email, user_role, COUNT(*) as count FROM audit_logs WHERE created_at >= :week_start AND user_email IS NOT NULL GROUP BY user_email, user_role ORDER BY count DESC LIMIT 10"
            ),
            {"week_start": week_start},
        ).fetchall()
        top_users = [{"email": r[0], "role": r[1], "count": r[2]} for r in top_users_raw]

        # Activity by hour (last 24h)
        activity_by_hour_raw = db.execute(
            text(
                "SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours' GROUP BY hour ORDER BY hour"
            )
        ).fetchall()
        hour_map = {int(r[0]): r[1] for r in activity_by_hour_raw}
        activity_by_hour = [{"hour": h, "count": hour_map.get(h, 0)} for h in range(24)]

        # Activity by day (last 7 days)
        activity_by_day_raw = db.execute(
            text(
                "SELECT DATE(created_at) as date, COUNT(*) as count FROM audit_logs WHERE created_at >= :week_start GROUP BY date ORDER BY date"
            ),
            {"week_start": week_start},
        ).fetchall()
        activity_by_day = [{"date": str(r[0]), "count": r[1]} for r in activity_by_day_raw]

        return AuditSummaryResponse(
            total_events=total_events,
            events_today=events_today,
            events_this_week=events_this_week,
            failure_count=failure_count,
            failure_rate_pct=failure_rate_pct,
            top_actions=top_actions,
            top_users=top_users,
            activity_by_hour=activity_by_hour,
            activity_by_day=activity_by_day,
        )

    def export_audit_logs_csv(self, db: Session, **filter_kwargs) -> str:
        """Exports filtered audit logs as a CSV string."""
        import csv
        import io

        logs_response = self.get_audit_logs(db, skip=0, limit=10000, **filter_kwargs)

        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "timestamp",
                "user_email",
                "user_role",
                "action",
                "action_category",
                "entity_type",
                "entity_name",
                "status",
                "duration_ms",
                "ip_address",
                "error_message",
            ],
        )
        writer.writeheader()

        for log in logs_response.logs:
            writer.writerow(
                {
                    "timestamp": log.created_at.isoformat(),
                    "user_email": log.user_email or "system",
                    "user_role": log.user_role or "",
                    "action": log.action,
                    "action_category": log.action_category,
                    "entity_type": log.entity_type or "",
                    "entity_name": log.entity_name or "",
                    "status": log.status,
                    "duration_ms": log.duration_ms or "",
                    "ip_address": log.ip_address or "",
                    "error_message": log.error_message or "",
                }
            )

        return output.getvalue()

    def get_user_activity(self, db: Session, user_id: UUID) -> UserActivitySummaryResponse:
        """Activity summary for a specific user."""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="User not found")

        total_actions = db.query(AuditLog).filter(AuditLog.user_id == user_id).count()
        last_log = (
            db.query(AuditLog)
            .filter(AuditLog.user_id == user_id)
            .order_by(desc(AuditLog.created_at))
            .first()
        )

        action_breakdown_raw = db.execute(
            text(
                "SELECT action, COUNT(*) as count FROM audit_logs WHERE user_id = :user_id GROUP BY action ORDER BY count DESC LIMIT 10"
            ),
            {"user_id": user_id},
        ).fetchall()
        action_breakdown = [
            {"action_label": ACTION_LABELS.get(r[0], (r[0], ""))[0], "count": r[1]}
            for r in action_breakdown_raw
        ]

        recent_logs = (
            db.query(AuditLog)
            .filter(AuditLog.user_id == user_id)
            .order_by(desc(AuditLog.created_at))
            .limit(20)
            .all()
        )

        return UserActivitySummaryResponse(
            user_id=user.id,
            user_email=user.email,
            user_role=user.role,
            total_actions=total_actions,
            last_seen=last_log.created_at if last_log else None,
            last_seen_label=self._compute_time_ago(last_log.created_at) if last_log else "Never",
            action_breakdown=action_breakdown,
            recent_logs=[self._build_log_response(log) for log in recent_logs],
        )

    def _build_log_response(self, log: AuditLog) -> AuditLogResponse:
        """Maps ORM model to schema with computed fields."""
        action_info = ACTION_LABELS.get(log.action, (log.action, "system"))
        action_label, action_category = action_info

        user_display = log.user_email or "System"
        status_label = {"success": "Success", "failure": "Failed", "warning": "Warning"}.get(
            log.status, log.status.capitalize()
        )

        duration_label = None
        if log.duration_ms is not None:
            if log.duration_ms < 1000:
                duration_label = f"{log.duration_ms}ms"
            else:
                duration_label = f"{log.duration_ms / 1000:.1f}s"

        return AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=log.user_email,
            user_role=log.user_role,
            user_display=user_display,
            action=log.action,
            action_label=action_label,
            action_category=action_category,
            entity_name=log.entity_name,
            entity_id=log.entity_id,
            metadata=log.event_metadata or {},
            ip_address=log.ip_address,
            status=log.status,
            status_label=status_label,
            duration_ms=log.duration_ms,
            duration_label=duration_label,
            error_message=log.error_message,
            created_at=log.created_at,
            time_ago=self._compute_time_ago(log.created_at),
        )

    def _compute_time_ago(self, dt: datetime) -> str:
        if not dt:
            return ""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = now - dt

        seconds = int(diff.total_seconds())
        if seconds < 60:
            return "just now"
        if seconds < 3600:
            return f"{seconds // 60}m ago"
        if seconds < 86400:
            return f"{seconds // 3600}h ago"
        return f"{seconds // 86400}d ago"


audit_service = AuditService()
