"""
app/routers/reports.py — Report generation and management API routes.
Prefix: /api/v1/reports
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.report import ReportTemplate, ReportSchedule
from app.models.user import User
from app.schemas.report import (
    GenerateReportRequest, GeneratedReportResponse,
    ReportScheduleCreate, ReportScheduleResponse,
    ReportScheduleUpdate, ReportTemplateCreate,
    ReportTemplateResponse, ReportTemplateUpdate,
)
from app.services.report_service import report_service

router = APIRouter(prefix="/api/v1/reports", tags=["Automated Reporting"])


def _tmpl_to_resp(t: ReportTemplate) -> ReportTemplateResponse:
    return ReportTemplateResponse(
        id=str(t.id), name=t.name, description=t.description,
        report_type=t.report_type, output_formats=t.output_formats or ["pdf"],
        config=t.config or {}, is_active=t.is_active,
        created_by_name=t.creator.full_name if t.creator else None,
        created_at=t.created_at,
    )


def _schedule_to_resp(s: ReportSchedule) -> ReportScheduleResponse:
    try:
        from croniter import croniter
        from datetime import datetime, timezone
        nxt = croniter(s.cron_expression, datetime.now(timezone.utc)).get_next(datetime)
        nxt_run = nxt
    except Exception:
        nxt_run = s.next_run_at

    cron_map = {
        "0 9 * * 1": "Every Monday at 9:00 AM",
        "0 8 * * *": "Every day at 8:00 AM",
        "0 9 1 * *": "First of every month at 9:00 AM",
        "0 0 * * 0": "Every Sunday at midnight",
    }
    human = cron_map.get(s.cron_expression, s.cron_expression)

    return ReportScheduleResponse(
        id=str(s.id), template_id=str(s.template_id),
        template_name=s.template.name if s.template else None,
        name=s.name, cron_expression=s.cron_expression,
        cron_human_readable=human, timezone=s.timezone,
        output_format=s.output_format, delivery_method=s.delivery_method,
        email_recipients=s.email_recipients or [], is_active=s.is_active,
        last_run_at=s.last_run_at, last_run_status=s.last_run_status,
        next_run_at=nxt_run, created_at=s.created_at,
    )


# ── Templates ──────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[ReportTemplateResponse])
def list_templates(cur: User = Depends(get_current_user), db: Session = Depends(get_db)):
    templates = db.query(ReportTemplate).filter(ReportTemplate.is_active == True).order_by(ReportTemplate.created_at).all()
    return [_tmpl_to_resp(t) for t in templates]


@router.post("/templates", response_model=ReportTemplateResponse, status_code=201)
def create_template(body: ReportTemplateCreate, cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    t = ReportTemplate(name=body.name, description=body.description, report_type=body.report_type,
                       output_formats=body.output_formats, config=body.config.model_dump(), created_by=cur.id)
    db.add(t); db.commit(); db.refresh(t)
    return _tmpl_to_resp(t)


@router.put("/templates/{tid}", response_model=ReportTemplateResponse)
def update_template(tid: str, body: ReportTemplateUpdate, cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    t = db.query(ReportTemplate).filter(ReportTemplate.id == tid).first()
    if not t: raise HTTPException(404, "Template not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v.model_dump() if hasattr(v, "model_dump") else v)
    db.commit(); db.refresh(t)
    return _tmpl_to_resp(t)


@router.delete("/templates/{tid}", status_code=204)
def delete_template(tid: str, cur: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    t = db.query(ReportTemplate).filter(ReportTemplate.id == tid).first()
    if not t: raise HTTPException(404)
    t.is_active = False; db.commit()


# ── Generate & History ─────────────────────────────────────────────────

@router.post("/generate", response_model=GeneratedReportResponse)
def generate_report(body: GenerateReportRequest, cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    return report_service.generate_report(db, body, cur.id, "manual")


@router.get("/history", response_model=list[GeneratedReportResponse])
def list_history(skip: int = 0, limit: int = Query(20, le=100),
                 report_type: str | None = None, output_format: str | None = None,
                 cur: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return report_service.list_reports(db, cur, skip, limit, report_type, output_format)


@router.get("/{report_id}/download")
def download_report(report_id: str, cur: User = Depends(get_current_user), db: Session = Depends(get_db)):
    content, filename, content_type = report_service.get_report_bytes(db, report_id, cur.id)
    return StreamingResponse(
        iter([content]),
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(content)),
        },
    )


@router.delete("/{report_id}", status_code=204)
def delete_report(report_id: str, cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    report_service.delete_report(db, report_id, cur)


# ── Schedules ──────────────────────────────────────────────────────────

@router.get("/schedules", response_model=list[ReportScheduleResponse])
def list_schedules(cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    schedules = db.query(ReportSchedule).order_by(ReportSchedule.created_at.desc()).all()
    return [_schedule_to_resp(s) for s in schedules]


@router.post("/schedules", response_model=ReportScheduleResponse, status_code=201)
def create_schedule(body: ReportScheduleCreate, cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    s = ReportSchedule(**body.model_dump(), created_by=cur.id)
    db.add(s); db.commit(); db.refresh(s)
    return _schedule_to_resp(s)


@router.put("/schedules/{sid}", response_model=ReportScheduleResponse)
def update_schedule(sid: str, body: ReportScheduleUpdate, cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    s = db.query(ReportSchedule).filter(ReportSchedule.id == sid).first()
    if not s: raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit(); db.refresh(s)
    return _schedule_to_resp(s)


@router.patch("/schedules/{sid}/toggle", response_model=ReportScheduleResponse)
def toggle_schedule(sid: str, cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    s = db.query(ReportSchedule).filter(ReportSchedule.id == sid).first()
    if not s: raise HTTPException(404)
    s.is_active = not s.is_active
    db.commit(); db.refresh(s)
    return _schedule_to_resp(s)


@router.delete("/schedules/{sid}", status_code=204)
def delete_schedule(sid: str, cur: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    s = db.query(ReportSchedule).filter(ReportSchedule.id == sid).first()
    if not s: raise HTTPException(404)
    db.delete(s); db.commit()


@router.get("/preview/{report_type}")
def preview_report(report_type: str, date_range_days: int = Query(7, ge=1, le=365),
                   cur: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    from app.services.report_data_service import report_data_service
    start, end = report_data_service.get_date_range(date_range_days)
    config_map = {
        "executive_summary": {"include_kpi_summary": True, "include_query_analytics": False, "include_upload_summary": False, "include_workflow_status": False, "include_top_templates": False},
        "query_analytics": {"include_kpi_summary": False, "include_query_analytics": True, "include_upload_summary": False, "include_workflow_status": False, "include_top_templates": False},
        "upload_report": {"include_kpi_summary": False, "include_query_analytics": False, "include_upload_summary": True, "include_workflow_status": False, "include_top_templates": False},
    }
    from app.schemas.report import ReportConfig
    cfg = ReportConfig(**(config_map.get(report_type, {})))
    data = report_data_service.collect_all(db, cfg, start, end)
    return {"report_type": report_type, "date_range_start": start.isoformat(), "date_range_end": end.isoformat(), "data": data}
