"""
app/services/report_service.py
Master report orchestrator: collect → render → save → record → expire.
"""
from __future__ import annotations
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from sqlalchemy.orm import Session
from app.core.logger import get_logger
from app.models.report import GeneratedReport, ReportTemplate, ReportSchedule
from app.schemas.report import (
    GenerateReportRequest, GeneratedReportResponse, ReportConfig,
)
from app.services.report_data_service import report_data_service
from app.services.pdf_service import pdf_service
from app.services.csv_service import csv_service

REPORT_DIR = Path("generated_reports")
logger = get_logger(__name__)

TYPE_LABELS = {
    "executive_summary": "Executive Summary",
    "query_analytics": "Query Analytics Report",
    "upload_report": "Upload Activity Report",
    "workflow_report": "Workflow Status Report",
    "ai_usage": "AI Usage Report",
    "custom_sql": "Custom Report",
}


class ReportService:
    def __init__(self):
        REPORT_DIR.mkdir(exist_ok=True)

    def _build_report_name(self, report_type: str, start: date, end: date) -> str:
        label = TYPE_LABELS.get(report_type, "Platform Report")
        return f"{label} — {start.strftime('%b %d')} to {end.strftime('%b %d, %Y')}"

    def _save_to_disk(self, content: bytes, report_id: uuid.UUID, fmt: str) -> tuple[str, int]:
        ext = "pdf" if fmt == "pdf" else "csv"
        path = REPORT_DIR / f"{report_id}.{ext}"
        path.write_bytes(content)
        return str(path), len(content)

    def _to_response(self, r: GeneratedReport) -> GeneratedReportResponse:
        name = r.generator.full_name if r.generator else None
        return GeneratedReportResponse(
            id=str(r.id), report_type=r.report_type, report_name=r.report_name,
            output_format=r.output_format, file_size_bytes=r.file_size_bytes or 0,
            generation_source=r.generation_source, date_range_start=r.date_range_start,
            date_range_end=r.date_range_end, metadata=r.metadata, status=r.status,
            generated_by_name=name, generated_at=r.generated_at,
            download_url=f"/api/v1/reports/{r.id}/download",
        )

    def generate_report(
        self, db: Session, request: GenerateReportRequest,
        generated_by_id, generation_source: str = "manual",
    ) -> GeneratedReportResponse:
        # Resolve config
        if request.template_id:
            tmpl = db.query(ReportTemplate).filter(ReportTemplate.id == request.template_id).first()
            if not tmpl:
                raise ValueError("Template not found")
            base_cfg = {**(tmpl.config or {}), **request.config_overrides}
            report_type = tmpl.report_type
            template_id = tmpl.id
        else:
            base_cfg = request.config_overrides
            report_type = request.report_type
            template_id = None

        config = ReportConfig(**base_cfg)
        start, end = report_data_service.get_date_range(request.date_range_days)
        report_name = self._build_report_name(report_type, start, end)

        # Create pending record
        record = GeneratedReport(
            template_id=template_id, generated_by=generated_by_id,
            report_type=report_type, report_name=report_name,
            output_format=request.output_format, generation_source=generation_source,
            status="generating",
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        try:
            report_data = report_data_service.collect_all(db, config, start, end)
            if request.output_format == "pdf":
                content = pdf_service.generate_pdf(report_data, config, report_name)
            else:
                content = csv_service.generate_csv(report_data, config, report_name)

            file_path, file_size = self._save_to_disk(content, record.id, request.output_format)
            sections = [k for k in report_data.keys() if k not in ("period", "generated_at")]

            record.status = "ready"
            record.file_path = file_path
            record.file_size_bytes = file_size
            record.date_range_start = start
            record.date_range_end = end
            record.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
            record.metadata = {"sections_included": sections, "date_range_days": request.date_range_days}
            db.commit()
            db.refresh(record)
            logger.info("Report ready: %s (%s bytes)", report_name, file_size)

        except Exception as exc:
            record.status = "failed"
            record.error_message = str(exc)
            db.commit()
            logger.error("Report generation failed: %s", exc)
            raise

        # Audit success
        try:
            from app.services.audit_service import audit_service
            audit_service.write_log(
                db,
                action="REPORT_GENERATED",
                user_id=generated_by_id,
                entity_type="report",
                entity_id=record.id,
                entity_name=record.report_name,
                status="success",
                event_metadata={"format": record.output_format, "rows": 0}, # row count not easily available here
            )
        except Exception as e:
            logger.error(f"Report audit log failed: {e}")

        return self._to_response(record)

    def get_report_bytes(self, db: Session, report_id: str, current_user_id) -> tuple[bytes, str, str]:
        from fastapi import HTTPException
        r = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
        if not r: raise HTTPException(404, "Report not found")
        if r.status != "ready": raise HTTPException(400, "Report is not ready for download")
        if r.expires_at and r.expires_at < datetime.now(timezone.utc): raise HTTPException(410, "Report has expired")
        path = Path(r.file_path)
        if not path.exists(): raise HTTPException(404, "Report file not found on server")
        content = path.read_bytes()
        ext = r.output_format
        content_type = "application/pdf" if ext == "pdf" else "text/csv"
        safe = r.report_name.replace(" ", "_").replace("—", "-").replace("–", "-")
        filename = f"{safe}.{ext}"

        # Audit download
        try:
            from app.services.audit_service import audit_service
            audit_service.write_log(
                db,
                action="REPORT_DOWNLOADED",
                user_id=current_user_id,
                entity_type="report",
                entity_id=r.id,
                entity_name=r.report_name,
                status="success",
            )
        except Exception as e:
            logger.error(f"Report download audit log failed: {e}")

        return content, filename, content_type

    def list_reports(self, db: Session, current_user, skip: int, limit: int,
                     report_type: str | None, output_format: str | None) -> list[GeneratedReportResponse]:
        q = db.query(GeneratedReport)
        if current_user.role == "analyst":
            q = q.filter(GeneratedReport.generated_by == current_user.id)
        if report_type: q = q.filter(GeneratedReport.report_type == report_type)
        if output_format: q = q.filter(GeneratedReport.output_format == output_format)
        records = q.order_by(GeneratedReport.generated_at.desc()).offset(skip).limit(limit).all()
        return [self._to_response(r) for r in records]

    def delete_report(self, db: Session, report_id: str, current_user) -> None:
        from fastapi import HTTPException
        r = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
        if not r: raise HTTPException(404, "Report not found")
        if current_user.role not in ("admin", "manager") and str(r.generated_by) != str(current_user.id):
            raise HTTPException(403, "Not allowed")
        if r.file_path:
            p = Path(r.file_path)
            if p.exists(): p.unlink()
        db.delete(r)
        db.commit()

    def cleanup_expired_reports(self, db: Session) -> int:
        expired = db.query(GeneratedReport).filter(
            GeneratedReport.expires_at < datetime.now(timezone.utc),
            GeneratedReport.status == "ready",
        ).all()
        count = 0
        for r in expired:
            if r.file_path:
                p = Path(r.file_path)
                if p.exists(): p.unlink()
            db.delete(r)
            count += 1
        db.commit()
        logger.info("Cleaned up %d expired reports", count)
        return count


report_service = ReportService()
