"""
app/services/report_data_service.py
Collects structured data from all platform tables for report sections.
"""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.logger import get_logger
from app.schemas.report import ReportConfig

logger = get_logger(__name__)


class ReportDataService:

    def get_date_range(self, days: int) -> tuple[date, date]:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        return start_date, end_date

    def collect_kpi_summary(self, db: Session, start: date, end: date) -> dict:
        def row(sql, params=None):
            return db.execute(text(sql), params or {}).fetchone()

        q = row("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status='success') AS successful,
                   COUNT(*) FILTER (WHERE status='failed') AS failed,
                   ROUND(AVG(execution_ms) FILTER (WHERE status='success'),0) AS avg_ms,
                   COUNT(DISTINCT executed_by) AS unique_users
            FROM query_history
            WHERE executed_at::date BETWEEN :s AND :e
        """, {"s": start, "e": end})

        u = row("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status='success') AS successful,
                   COALESCE(SUM(row_count) FILTER (WHERE status='success'),0) AS rows
            FROM data_uploads
            WHERE created_at::date BETWEEN :s AND :e
        """, {"s": start, "e": end})

        w = row("SELECT COUNT(*) FILTER (WHERE is_active) AS active, COUNT(*) FILTER (WHERE is_active AND last_run_status='failed') AS failing FROM scheduled_workflows")
        ai = row("""
            SELECT COUNT(*) AS total, COALESCE(SUM(total_tokens),0) AS tokens,
                   COUNT(*) FILTER (WHERE was_executed) AS executed
            FROM ai_query_sessions WHERE created_at::date BETWEEN :s AND :e
        """, {"s": start, "e": end})

        total_users = db.execute(text("SELECT COUNT(*) FROM users WHERE is_active=TRUE")).scalar() or 0

        q_total = int(q[0] or 0)
        u_total = int(u[0] or 0)
        wf_active = int(w[0] or 0)
        ai_total = int(ai[0] or 0)

        return {
            "period": {"start": start.isoformat(), "end": end.isoformat(), "days": (end - start).days},
            "queries": {
                "total": q_total, "successful": int(q[1] or 0), "failed": int(q[2] or 0),
                "success_rate": round((q[1] or 0) / q_total * 100, 1) if q_total else 0.0,
                "avg_ms": int(q[3] or 0), "unique_users": int(q[4] or 0),
            },
            "uploads": {
                "total": u_total, "successful": int(u[1] or 0), "rows_ingested": int(u[2] or 0),
                "success_rate": round((u[1] or 0) / u_total * 100, 1) if u_total else 0.0,
            },
            "workflows": {
                "active": wf_active, "failing": int(w[1] or 0),
                "health_pct": round(((wf_active - (w[1] or 0)) / wf_active * 100), 1) if wf_active else 100.0,
            },
            "ai": {
                "sessions": ai_total, "tokens_used": int(ai[1] or 0),
                "execution_rate": round((ai[2] or 0) / ai_total * 100, 1) if ai_total else 0.0,
            },
            "users": {"unique_active": int(q[4] or 0), "total": total_users},
        }

    def collect_query_analytics(self, db: Session, start: date, end: date) -> dict:
        daily = db.execute(text("""
            SELECT DATE(executed_at) AS day,
                   COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status='success') AS success,
                   COUNT(*) FILTER (WHERE status='failed') AS failed,
                   ROUND(AVG(execution_ms) FILTER (WHERE status='success'),0) AS avg_ms
            FROM query_history WHERE executed_at::date BETWEEN :s AND :e
            GROUP BY 1 ORDER BY 1
        """), {"s": start, "e": end}).fetchall()

        slowest = db.execute(text("""
            SELECT LEFT(query_text,100) AS query_preview, execution_ms, status, executed_at, source
            FROM query_history
            WHERE executed_at::date BETWEEN :s AND :e AND status='success'
            ORDER BY execution_ms DESC LIMIT 10
        """), {"s": start, "e": end}).fetchall()

        by_source = db.execute(text("""
            SELECT source, COUNT(*) AS count FROM query_history
            WHERE executed_at::date BETWEEN :s AND :e GROUP BY source
        """), {"s": start, "e": end}).fetchall()

        total_queries = sum(r[1] for r in daily)
        total_success = sum(r[2] for r in daily)
        return {
            "daily_data": [{"day": str(r[0]), "total": r[1], "success": r[2], "failed": r[3], "avg_ms": int(r[4] or 0)} for r in daily],
            "slowest_queries": [{"query_preview": r[0], "execution_ms": r[1], "status": r[2], "executed_at": str(r[3]), "source": r[4]} for r in slowest],
            "by_source": {r[0]: r[1] for r in by_source},
            "totals": {"total": total_queries, "success": total_success, "failed": total_queries - total_success,
                       "success_rate": round(total_success / total_queries * 100, 1) if total_queries else 0},
        }

    def collect_upload_summary(self, db: Session, start: date, end: date) -> dict:
        uploads = db.execute(text("""
            SELECT du.file_name, du.file_type, du.row_count, du.target_table,
                   du.status, du.created_at, u.full_name AS uploaded_by
            FROM data_uploads du LEFT JOIN users u ON du.uploaded_by=u.id
            WHERE du.created_at::date BETWEEN :s AND :e ORDER BY du.created_at DESC LIMIT 100
        """), {"s": start, "e": end}).fetchall()

        daily = db.execute(text("""
            SELECT DATE(created_at) AS day, COUNT(*) AS uploads,
                   COALESCE(SUM(row_count),0) AS rows
            FROM data_uploads WHERE created_at::date BETWEEN :s AND :e
            GROUP BY 1 ORDER BY 1
        """), {"s": start, "e": end}).fetchall()

        return {
            "uploads": [{"file_name": r[0], "file_type": r[1], "row_count": r[2] or 0,
                          "target_table": r[3], "status": r[4], "created_at": str(r[5]), "uploaded_by": r[6]} for r in uploads],
            "daily_data": [{"day": str(r[0]), "uploads": r[1], "rows": int(r[2])} for r in daily],
            "totals": {"total": len(uploads), "total_rows": sum(r[2] or 0 for r in uploads)},
        }

    def collect_workflow_report(self, db: Session, start: date, end: date) -> dict:
        workflows = db.execute(text("""
            SELECT sw.name, sw.cron_expression, sw.is_active,
                   sw.last_run_at, sw.last_run_status, sw.failure_count,
                   st.name AS template_name, u.full_name AS created_by
            FROM scheduled_workflows sw
            LEFT JOIN sql_templates st ON sw.template_id=st.id
            LEFT JOIN users u ON sw.created_by=u.id
            ORDER BY sw.is_active DESC, sw.failure_count DESC
        """)).fetchall()

        exec_stats = db.execute(text("""
            SELECT qh.workflow_id, sw.name AS workflow_name,
                   COUNT(*) AS runs,
                   COUNT(*) FILTER (WHERE qh.status='success') AS successes,
                   COUNT(*) FILTER (WHERE qh.status='failed') AS failures,
                   ROUND(AVG(qh.execution_ms) FILTER (WHERE qh.status='success'),0) AS avg_ms
            FROM query_history qh JOIN scheduled_workflows sw ON qh.workflow_id=sw.id
            WHERE qh.executed_at::date BETWEEN :s AND :e
            GROUP BY 1,2
        """), {"s": start, "e": end}).fetchall()

        return {
            "workflows": [{"name": r[0], "cron_expression": r[1], "is_active": r[2],
                            "last_run_at": str(r[3]) if r[3] else "—", "last_run_status": r[4] or "—",
                            "failure_count": r[5] or 0, "template_name": r[6], "created_by": r[7]} for r in workflows],
            "execution_stats": [{"workflow_name": r[1], "runs": r[2], "successes": r[3],
                                  "failures": r[4], "avg_ms": int(r[5] or 0)} for r in exec_stats],
            "totals": {"total": len(workflows), "active": sum(1 for r in workflows if r[2]),
                       "failing": sum(1 for r in workflows if (r[5] or 0) > 0)},
        }

    def collect_ai_usage(self, db: Session, start: date, end: date) -> dict:
        sessions = db.execute(text("""
            SELECT LEFT(aqs.natural_language,80) AS question, aqs.was_executed,
                   aqs.execution_status, aqs.total_tokens, aqs.row_count,
                   aqs.created_at, u.full_name AS asked_by
            FROM ai_query_sessions aqs LEFT JOIN users u ON aqs.user_id=u.id
            WHERE aqs.created_at::date BETWEEN :s AND :e
            ORDER BY aqs.created_at DESC LIMIT 50
        """), {"s": start, "e": end}).fetchall()

        daily = db.execute(text("""
            SELECT DATE(created_at) AS day, SUM(total_tokens) AS tokens, COUNT(*) AS sessions
            FROM ai_query_sessions WHERE created_at::date BETWEEN :s AND :e
            GROUP BY 1 ORDER BY 1
        """), {"s": start, "e": end}).fetchall()

        return {
            "sessions": [{"question": r[0], "was_executed": r[1], "execution_status": r[2],
                           "total_tokens": r[3] or 0, "row_count": r[4] or 0,
                           "created_at": str(r[5]), "asked_by": r[6]} for r in sessions],
            "daily_tokens": [{"day": str(r[0]), "tokens": int(r[1] or 0), "sessions": r[2]} for r in daily],
            "totals": {"total": len(sessions), "tokens": sum(r[3] or 0 for r in sessions)},
        }

    def collect_top_templates(self, db: Session, start: date, end: date) -> list[dict]:
        rows = db.execute(text("""
            SELECT st.name, COUNT(qh.id) AS executions,
                   ROUND(COUNT(qh.id) FILTER (WHERE qh.status='success')::NUMERIC/NULLIF(COUNT(qh.id),0)*100,1) AS success_rate,
                   ROUND(AVG(qh.execution_ms) FILTER (WHERE qh.status='success'),0) AS avg_ms
            FROM sql_templates st
            LEFT JOIN query_history qh ON st.id=qh.template_id AND qh.executed_at::date BETWEEN :s AND :e
            WHERE st.is_active=TRUE
            GROUP BY st.id, st.name ORDER BY executions DESC LIMIT 10
        """), {"s": start, "e": end}).fetchall()
        return [{"name": r[0], "executions": r[1] or 0, "success_rate": float(r[2] or 0), "avg_ms": int(r[3] or 0)} for r in rows]

    def collect_all(self, db: Session, config: ReportConfig, start: date, end: date) -> dict:
        result: dict = {
            "period": {"start": start.isoformat(), "end": end.isoformat(), "days": (end - start).days},
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            if config.include_kpi_summary:
                result["kpi"] = self.collect_kpi_summary(db, start, end)
            if config.include_query_analytics:
                result["queries"] = self.collect_query_analytics(db, start, end)
            if config.include_upload_summary:
                result["uploads"] = self.collect_upload_summary(db, start, end)
            if config.include_workflow_status:
                result["workflows"] = self.collect_workflow_report(db, start, end)
            if config.include_ai_usage:
                result["ai"] = self.collect_ai_usage(db, start, end)
            if config.include_top_templates:
                result["templates"] = self.collect_top_templates(db, start, end)
        except Exception as exc:
            logger.error("Data collection error: %s", exc)
        return result


report_data_service = ReportDataService()
