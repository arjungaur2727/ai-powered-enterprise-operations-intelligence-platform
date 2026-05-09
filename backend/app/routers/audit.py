"""
app/routers/audit.py
Audit Logs & System Monitoring API routes.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.ai_session import AIQuerySession
from app.models.alert import Alert
from app.models.audit import AuditLog
from app.models.query_history import QueryHistory
from app.models.report import GeneratedReport
from app.models.scheduled_workflow import ScheduledWorkflow
from app.models.upload import DataUpload
from app.schemas.audit import (
    AuditLogListResponse,
    AuditLogResponse,
    AuditSummaryResponse,
    SchedulerJobResponse,
    SystemHealthResponse,
    UserActivitySummaryResponse,
)
from app.services.audit_service import audit_service
from app.services.monitoring_service import monitoring_service

router = APIRouter(prefix="/api/v1", tags=["Audit & Monitoring"])


@router.get("/audit", response_model=AuditLogListResponse)
def get_audit_logs(
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
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return audit_service.get_audit_logs(
        db, skip, limit, action, action_category, user_id, entity_type, status, date_from, date_to, search
    )


@router.get("/audit/summary", response_model=AuditSummaryResponse)
def get_audit_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return audit_service.get_audit_summary(db)


@router.get("/audit/export")
def export_audit_logs(
    action: str | None = None,
    action_category: str | None = None,
    user_id: UUID | None = None,
    entity_type: str | None = None,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    csv_content = audit_service.export_audit_logs_csv(
        db,
        action=action,
        action_category=action_category,
        user_id=user_id,
        entity_type=entity_type,
        status=status,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    audit_service.write_log(
        db,
        action="AUDIT_EXPORT",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        event_metadata={
            "filters": {
                "action": action,
                "category": action_category,
                "user_id": str(user_id) if user_id else None,
                "search": search,
            }
        },
    )

    filename = f"audit_log_{datetime.now().date().isoformat()}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/audit/user/{user_id}", response_model=UserActivitySummaryResponse)
def get_user_activity(
    user_id: UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return audit_service.get_user_activity(db, user_id)


@router.get("/audit/entity/{entity_type}/{entity_id}", response_model=list[AuditLogResponse])
def get_entity_audit_log(
    entity_type: str,
    entity_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == entity_type, AuditLog.entity_id == entity_id)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
        .all()
    )
    return [audit_service._build_log_response(log) for log in logs]


@router.get("/monitoring/health", response_model=SystemHealthResponse)
def get_system_health(request: Request, db: Session = Depends(get_db)):
    # Public ping endpoint
    scheduler = getattr(request.app.state, "scheduler", None)
    health = monitoring_service.get_live_health(db, scheduler)

    if health.status == "down":
        raise HTTPException(status_code=503, detail=health.status_label)

    return health


@router.get("/monitoring/stats")
def get_monitoring_stats(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    health = monitoring_service.get_live_health(db)
    summary = audit_service.get_audit_summary(db)

    return {
        "health": health,
        "audit_summary": summary,
        "platform_totals": {
            "total_queries": db.query(func.count(QueryHistory.id)).scalar(),
            "total_uploads": db.query(func.count(DataUpload.id)).scalar(),
            "total_ai_queries": db.query(func.count(AIQuerySession.id)).scalar(),
            "total_alerts": db.query(func.count(Alert.id)).scalar(),
            "total_reports": db.query(func.count(GeneratedReport.id)).scalar(),
            "total_workflows": db.query(func.count(ScheduledWorkflow.id)).scalar(),
        },
    }


@router.get("/monitoring/snapshots")
def get_health_snapshots(
    hours: int = Query(24, le=168), db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return monitoring_service.get_snapshots(db, hours)


@router.get("/monitoring/scheduler", response_model=list[SchedulerJobResponse])
def get_scheduler_status(request: Request, current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    scheduler = getattr(request.app.state, "scheduler", None)
    return monitoring_service.get_scheduler_jobs(scheduler)
