"""
app/services/dashboard_service.py
Analytics service — queries live platform tables for the KPI dashboard.
"""
from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from typing import Any
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.logger import get_logger
from app.schemas.dashboard import (
    AIConfidenceResponse, ActivityFeedItem, KPISummaryResponse,
    KPISnapshotCreate, PerformanceAlert, PerformanceTrendResponse,
    QueryTrendResponse, DualTrendDataPoint, TokenUsageDataPoint,
    TopTemplateItem, TopUserItem, UploadTrendResponse, WorkflowStatusResponse,
)

logger = get_logger(__name__)


def _pct_change(current: int, previous: int) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round(((current - previous) / previous) * 100, 1)


def _fill_date_series(data_dict: dict, days: int, zero_record: dict) -> list[dict]:
    today = date.today()
    result = []
    for i in range(days, -1, -1):
        d = (today - timedelta(days=i)).isoformat()
        result.append(data_dict.get(d, {**zero_record, "date": d}))
    return result


class DashboardService:

    # ------------------------------------------------------------------
    # 1. KPI Summary
    # ------------------------------------------------------------------
    def get_kpi_summary(self, db: Session) -> KPISummaryResponse:
        def scalar(q, *params):
            return db.execute(text(q), *params).fetchone()

        # Query history today
        r = scalar("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status='success') AS success,
                   COUNT(*) FILTER (WHERE status='failed') AS failed,
                   ROUND(AVG(execution_ms) FILTER (WHERE status='success'),0) AS avg_ms
            FROM query_history
            WHERE DATE(executed_at AT TIME ZONE 'UTC') = CURRENT_DATE
        """)
        q_total, q_success, q_failed, q_avg_ms = (r[0] or 0), (r[1] or 0), (r[2] or 0), r[3]

        r2 = scalar("SELECT COUNT(*) FROM query_history WHERE DATE(executed_at AT TIME ZONE 'UTC') = CURRENT_DATE - INTERVAL '1 day'")
        q_yesterday = r2[0] or 0

        # Uploads today
        r = scalar("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status='success') AS success,
                   COALESCE(SUM(row_count) FILTER (WHERE status='success'),0) AS rows
            FROM data_uploads
            WHERE DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE
        """)
        u_total, u_success, u_rows = (r[0] or 0), (r[1] or 0), (r[2] or 0)

        r2 = scalar("SELECT COUNT(*) FROM data_uploads WHERE DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE - INTERVAL '1 day'")
        u_yesterday = r2[0] or 0

        # Workflows
        r = scalar("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE is_active=TRUE) AS active,
                   COUNT(*) FILTER (WHERE is_active=TRUE AND last_run_status='failed') AS failing,
                   COUNT(*) FILTER (WHERE is_active=FALSE) AS inactive
            FROM scheduled_workflows
        """)
        wf_total, wf_active, wf_failing = (r[0] or 0), (r[1] or 0), (r[2] or 0)

        # AI today
        r = scalar("""
            SELECT COUNT(*) AS total,
                   COALESCE(SUM(total_tokens),0) AS tokens,
                   COUNT(*) FILTER (WHERE was_executed=TRUE) AS executed
            FROM ai_query_sessions
            WHERE DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE
        """)
        ai_total, ai_tokens, ai_executed = (r[0] or 0), (r[1] or 0), (r[2] or 0)

        r2 = scalar("SELECT COUNT(*) FROM ai_query_sessions WHERE DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE - INTERVAL '1 day'")
        ai_yesterday = r2[0] or 0

        # Users
        r = scalar("""
            SELECT
              (SELECT COUNT(DISTINCT user_id) FROM audit_logs WHERE DATE(created_at AT TIME ZONE 'UTC')=CURRENT_DATE) AS active_today,
              (SELECT COUNT(*) FROM users WHERE is_active=TRUE) AS total
        """)
        active_users, total_users = (r[0] or 0), (r[1] or 0)

        return KPISummaryResponse(
            queries_today=q_total,
            queries_success_today=q_success,
            queries_failed_today=q_failed,
            query_success_rate_today=round((q_success / q_total * 100), 1) if q_total > 0 else 0.0,
            avg_execution_ms_today=float(q_avg_ms) if q_avg_ms is not None else 0.0,
            uploads_today=u_total,
            rows_ingested_today=u_rows,
            upload_success_rate_today=round((u_success / u_total * 100), 1) if u_total > 0 else 0.0,
            active_workflows=wf_active,
            failing_workflows=wf_failing,
            workflow_health_pct=round(((wf_active - wf_failing) / wf_active * 100), 1) if wf_active > 0 else 100.0,
            ai_queries_today=ai_total,
            ai_tokens_today=ai_tokens,
            ai_execution_rate_today=round((ai_executed / ai_total * 100), 1) if ai_total > 0 else 0.0,
            active_users_today=active_users,
            total_users=total_users,
            queries_vs_yesterday=_pct_change(q_total, q_yesterday),
            uploads_vs_yesterday=_pct_change(u_total, u_yesterday),
            ai_queries_vs_yesterday=_pct_change(ai_total, ai_yesterday),
        )

    # ------------------------------------------------------------------
    # 2. Query trend
    # ------------------------------------------------------------------
    def get_query_trend(self, db: Session, days: int = 14) -> QueryTrendResponse:
        rows = db.execute(text(f"""
            SELECT DATE(executed_at AT TIME ZONE 'UTC') AS day,
                   COUNT(*) FILTER (WHERE status='success') AS success_count,
                   COUNT(*) FILTER (WHERE status='failed') AS failed_count,
                   COUNT(*) AS total_count
            FROM query_history
            WHERE executed_at >= NOW() - INTERVAL '{days} days'
            GROUP BY 1 ORDER BY 1
        """)).fetchall()

        data_dict = {str(r[0]): DualTrendDataPoint(date=str(r[0]), value_a=r[1] or 0, value_b=r[2] or 0) for r in rows}
        today = date.today()
        filled = []
        total = 0
        for i in range(days, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            pt = data_dict.get(d, DualTrendDataPoint(date=d, value_a=0, value_b=0))
            filled.append(pt)
            total += int(pt.value_a) + int(pt.value_b)
        return QueryTrendResponse(data=filled, total_period=total, period_days=days)

    # ------------------------------------------------------------------
    # 3. Upload trend
    # ------------------------------------------------------------------
    def get_upload_trend(self, db: Session, days: int = 7) -> UploadTrendResponse:
        rows = db.execute(text(f"""
            SELECT DATE(created_at AT TIME ZONE 'UTC') AS day,
                   COUNT(*) AS upload_count,
                   COUNT(*) FILTER (WHERE status='success') AS success_count,
                   COUNT(*) FILTER (WHERE status='failed') AS failed_count,
                   COALESCE(SUM(row_count) FILTER (WHERE status='success'),0) AS rows_ingested
            FROM data_uploads
            WHERE created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY 1 ORDER BY 1
        """)).fetchall()

        data_dict = {str(r[0]): {"date": str(r[0]), "upload_count": r[1] or 0, "success_count": r[2] or 0, "failed_count": r[3] or 0, "rows_ingested": int(r[4] or 0)} for r in rows}
        today = date.today()
        filled = []
        for i in range(days, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            filled.append(data_dict.get(d, {"date": d, "upload_count": 0, "success_count": 0, "failed_count": 0, "rows_ingested": 0}))

        return UploadTrendResponse(
            data=filled,
            total_uploads=sum(p["upload_count"] for p in filled),
            total_rows=sum(p["rows_ingested"] for p in filled),
            period_days=days,
        )

    # ------------------------------------------------------------------
    # 4. Workflow status
    # ------------------------------------------------------------------
    def get_workflow_status(self, db: Session) -> WorkflowStatusResponse:
        r = db.execute(text("""
            SELECT
              COUNT(*) FILTER (WHERE is_active=TRUE AND last_run_status='success') AS healthy,
              COUNT(*) FILTER (WHERE is_active=TRUE AND last_run_status='failed') AS failing,
              COUNT(*) FILTER (WHERE is_active=FALSE) AS inactive,
              COUNT(*) FILTER (WHERE is_active=TRUE AND last_run_at IS NULL) AS never_run,
              COUNT(*) AS total
            FROM scheduled_workflows
        """)).fetchone()
        return WorkflowStatusResponse(
            active_and_healthy=r[0] or 0,
            active_and_failing=r[1] or 0,
            inactive=r[2] or 0,
            never_run=r[3] or 0,
            total=r[4] or 0,
        )

    # ------------------------------------------------------------------
    # 5. AI confidence distribution (proxy from execution results)
    # ------------------------------------------------------------------
    def get_ai_confidence_distribution(self, db: Session) -> AIConfidenceResponse:
        r = db.execute(text("""
            SELECT
              COUNT(*) FILTER (WHERE was_executed=TRUE AND execution_status='success') AS high_count,
              COUNT(*) FILTER (WHERE was_executed=TRUE AND execution_status='failed') AS medium_count,
              COUNT(*) FILTER (WHERE was_executed=FALSE) AS low_count,
              COUNT(*) AS total,
              ROUND(COUNT(*) FILTER (WHERE was_executed=TRUE)::NUMERIC / NULLIF(COUNT(*),0) * 100, 1) AS executed_pct
            FROM ai_query_sessions
            WHERE created_at >= NOW() - INTERVAL '30 days'
        """)).fetchone()
        return AIConfidenceResponse(
            high=r[0] or 0, medium=r[1] or 0, low=r[2] or 0,
            total=r[3] or 0, executed_pct=float(r[4] or 0),
        )

    # ------------------------------------------------------------------
    # 6. Token usage trend
    # ------------------------------------------------------------------
    def get_token_usage_trend(self, db: Session, days: int = 14) -> list[TokenUsageDataPoint]:
        rows = db.execute(text(f"""
            SELECT DATE(created_at AT TIME ZONE 'UTC') AS day,
                   SUM(prompt_tokens)::int, SUM(completion_tokens)::int,
                   SUM(total_tokens)::int, COUNT(*)::int
            FROM ai_query_sessions
            WHERE created_at >= NOW() - INTERVAL '{days} days'
            GROUP BY 1 ORDER BY 1
        """)).fetchall()

        data_dict = {str(r[0]): TokenUsageDataPoint(date=str(r[0]), prompt_tokens=r[1] or 0, completion_tokens=r[2] or 0, total_tokens=r[3] or 0, session_count=r[4] or 0) for r in rows}
        today = date.today()
        filled = []
        for i in range(days, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            filled.append(data_dict.get(d, TokenUsageDataPoint(date=d)))
        return filled

    # ------------------------------------------------------------------
    # 7. Performance trend
    # ------------------------------------------------------------------
    def get_performance_trend(self, db: Session, days: int = 14) -> PerformanceTrendResponse:
        rows = db.execute(text(f"""
            SELECT DATE(executed_at AT TIME ZONE 'UTC') AS day,
                   ROUND(AVG(execution_ms),0)::float AS avg_ms,
                   ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_ms),0)::float AS p95_ms,
                   COUNT(*)::int AS query_count
            FROM query_history
            WHERE status='success' AND executed_at >= NOW() - INTERVAL '{days} days'
            GROUP BY 1 ORDER BY 1
        """)).fetchall()

        data_dict = {str(r[0]): {"date": str(r[0]), "avg_ms": r[1] or 0, "p95_ms": r[2] or 0, "query_count": r[3] or 0} for r in rows}
        today = date.today()
        filled = []
        for i in range(days, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            filled.append(data_dict.get(d, {"date": d, "avg_ms": 0, "p95_ms": 0, "query_count": 0}))

        avg_values = [p["avg_ms"] for p in filled if p["avg_ms"] > 0]
        overall_avg = round(sum(avg_values) / len(avg_values), 1) if avg_values else 0.0
        return PerformanceTrendResponse(data=filled, overall_avg_ms=overall_avg, period_days=days)

    # ------------------------------------------------------------------
    # 8. Activity feed
    # ------------------------------------------------------------------
    def get_activity_feed(self, db: Session, limit: int = 20) -> list[ActivityFeedItem]:
        rows = db.execute(text("""
            SELECT * FROM (
              SELECT qh.id::text, 'query_executed' AS event_type,
                CASE WHEN qh.status='success' THEN 'SQL query executed successfully' ELSE 'SQL query failed' END AS title,
                CONCAT(qh.row_count,' rows • ',qh.execution_ms,'ms • ',qh.source) AS subtitle,
                u.full_name AS actor_name, u.role AS actor_role,
                CASE WHEN qh.status='success' THEN 'success' ELSE 'error' END AS severity,
                qh.executed_at AS ts,
                jsonb_build_object('source',qh.source) AS metadata
              FROM query_history qh LEFT JOIN users u ON qh.executed_by=u.id
              WHERE qh.executed_at >= NOW() - INTERVAL '24 hours'

              UNION ALL

              SELECT du.id::text, 'file_uploaded',
                CONCAT('File upload: ',du.file_name),
                CONCAT(du.row_count,' rows → ',COALESCE(du.target_table,'?'),' (',du.status,')'),
                u.full_name, u.role,
                CASE WHEN du.status='success' THEN 'success' WHEN du.status='failed' THEN 'error' ELSE 'info' END,
                du.created_at,
                jsonb_build_object('row_count',du.row_count)
              FROM data_uploads du LEFT JOIN users u ON du.uploaded_by=u.id
              WHERE du.created_at >= NOW() - INTERVAL '24 hours'

              UNION ALL

              SELECT aqs.id::text, 'ai_query', 'AI query generated',
                CONCAT(LEFT(aqs.natural_language,60),'… • ',aqs.total_tokens,' tokens'),
                u.full_name, u.role,
                CASE WHEN aqs.was_executed AND aqs.execution_status='success' THEN 'success'
                     WHEN aqs.was_executed AND aqs.execution_status='failed' THEN 'error'
                     ELSE 'info' END,
                aqs.created_at,
                jsonb_build_object('tokens',aqs.total_tokens,'executed',aqs.was_executed)
              FROM ai_query_sessions aqs LEFT JOIN users u ON aqs.user_id=u.id
              WHERE aqs.created_at >= NOW() - INTERVAL '24 hours'

              UNION ALL

              SELECT sw.id::text,
                CASE WHEN sw.last_run_status='failed' THEN 'workflow_failed' ELSE 'workflow_run' END,
                CONCAT('Scheduled workflow: ',sw.name),
                CONCAT('Status: ',COALESCE(sw.last_run_status,'unknown')),
                u.full_name, u.role,
                CASE WHEN sw.last_run_status='success' THEN 'success'
                     WHEN sw.last_run_status='failed' THEN 'error' ELSE 'warning' END,
                sw.last_run_at,
                jsonb_build_object('failure_count',sw.failure_count)
              FROM scheduled_workflows sw LEFT JOIN users u ON sw.created_by=u.id
              WHERE sw.last_run_at >= NOW() - INTERVAL '24 hours'
            ) combined
            WHERE ts IS NOT NULL
            ORDER BY ts DESC
            LIMIT :lim
        """), {"lim": limit}).fetchall()

        items = []
        for r in rows:
            try:
                items.append(ActivityFeedItem(
                    id=r[0], event_type=r[1], title=r[2], subtitle=r[3] or "",
                    actor_name=r[4], actor_role=r[5], severity=r[6] or "info",
                    timestamp=r[7], metadata=r[8],
                ))
            except Exception:
                pass
        return items

    # ------------------------------------------------------------------
    # 9. Performance alerts
    # ------------------------------------------------------------------
    def get_performance_alerts(self, db: Session) -> list[PerformanceAlert]:
        alerts: list[PerformanceAlert] = []

        # Alert 1: high query failure rate
        r = db.execute(text("""
            SELECT COUNT(*) FILTER (WHERE status='failed') AS failed, COUNT(*) AS total
            FROM query_history WHERE DATE(executed_at)=CURRENT_DATE
        """)).fetchone()
        if r and r[1] and r[1] > 0:
            pct = round(r[0] / r[1] * 100, 1)
            if pct > 20:
                alerts.append(PerformanceAlert(
                    alert_type="high_failure_rate", title="High Query Failure Rate",
                    description=f"{pct}% of today's queries failed",
                    severity="critical" if pct > 40 else "warning",
                    metric_value=pct, threshold_value=20.0, affected_count=int(r[0]),
                    recommendation="Review recent failed queries in SQL Workflows → Execution History",
                ))

        # Alert 2: slow average
        r = db.execute(text("SELECT ROUND(AVG(execution_ms),0) FROM query_history WHERE status='success' AND DATE(executed_at)=CURRENT_DATE")).fetchone()
        if r and r[0] and r[0] > 5000:
            alerts.append(PerformanceAlert(
                alert_type="slow_queries", title="Slow Average Query Performance",
                description=f"Average execution time today is {int(r[0])}ms",
                severity="warning", metric_value=float(r[0]), threshold_value=5000.0,
                affected_count=1, recommendation="Consider optimizing frequently run SQL templates",
            ))

        # Alert 3: repeatedly failing workflows
        r = db.execute(text("SELECT COUNT(*) FROM scheduled_workflows WHERE failure_count>=2 AND is_active=TRUE")).fetchone()
        if r and r[0] and r[0] > 0:
            cnt = int(r[0])
            alerts.append(PerformanceAlert(
                alert_type="workflow_failing", title=f"{cnt} Workflow{'s' if cnt>1 else ''} Repeatedly Failing",
                description=f"{cnt} active workflow{'s' if cnt>1 else ''} have failed 2+ times",
                severity="critical" if cnt > 3 else "warning",
                metric_value=float(cnt), threshold_value=1.0, affected_count=cnt,
                recommendation="Go to SQL Workflows → Scheduled to review and fix failing jobs",
            ))

        # Alert 4: high upload failure rate
        r = db.execute(text("SELECT COUNT(*) FILTER (WHERE status='failed') AS failed, COUNT(*) AS total FROM data_uploads WHERE DATE(created_at)=CURRENT_DATE")).fetchone()
        if r and r[1] and r[1] > 0:
            pct = round(r[0] / r[1] * 100, 1)
            if pct > 20:
                alerts.append(PerformanceAlert(
                    alert_type="upload_failures", title="High Upload Failure Rate",
                    description=f"{pct}% of today's uploads failed",
                    severity="warning", metric_value=pct, threshold_value=20.0,
                    affected_count=int(r[0]),
                    recommendation="Check Data Upload → Upload History for validation errors",
                ))

        # Alert 5: no activity
        if not alerts:
            r = db.execute(text("""
                SELECT
                  (SELECT COUNT(*) FROM query_history WHERE DATE(executed_at)=CURRENT_DATE),
                  (SELECT COUNT(*) FROM data_uploads WHERE DATE(created_at)=CURRENT_DATE),
                  (SELECT COUNT(*) FROM ai_query_sessions WHERE DATE(created_at)=CURRENT_DATE)
            """)).fetchone()
            if r and r[0] == 0 and r[1] == 0 and r[2] == 0:
                alerts.append(PerformanceAlert(
                    alert_type="no_activity", title="No Platform Activity Today",
                    description="No queries, uploads, or AI sessions recorded today",
                    severity="info", metric_value=0.0, threshold_value=1.0, affected_count=0,
                    recommendation="Verify the platform is accessible and users are logged in",
                ))
        return alerts

    # ------------------------------------------------------------------
    # 10. Top templates
    # ------------------------------------------------------------------
    def get_top_templates(self, db: Session, limit: int = 5) -> list[TopTemplateItem]:
        rows = db.execute(text("""
            SELECT st.id::text, st.name, st.description, COALESCE(st.execution_count,0),
                   st.tags, st.last_executed_at, u.full_name,
                   COUNT(qh.id) AS hist_count,
                   ROUND(COUNT(qh.id) FILTER (WHERE qh.status='success')::NUMERIC/NULLIF(COUNT(qh.id),0)*100,1) AS sr,
                   ROUND(AVG(qh.execution_ms) FILTER (WHERE qh.status='success'),0) AS avg_ms
            FROM sql_templates st
            LEFT JOIN query_history qh ON st.id=qh.template_id
            LEFT JOIN users u ON st.created_by=u.id
            WHERE st.is_active=TRUE
            GROUP BY st.id,st.name,st.description,st.execution_count,st.tags,st.last_executed_at,u.full_name
            ORDER BY st.execution_count DESC
            LIMIT :lim
        """), {"lim": limit}).fetchall()

        return [
            TopTemplateItem(
                id=r[0], name=r[1], description=r[2],
                execution_count=int(r[3] or 0),
                tags=r[4] or [],
                last_executed_at=r[5],
                created_by_name=r[6],
                success_rate=float(r[8] or 0),
                avg_execution_ms=float(r[9] or 0),
            )
            for r in rows
        ]

    # ------------------------------------------------------------------
    # 11. Top users
    # ------------------------------------------------------------------
    def get_top_users(self, db: Session, limit: int = 5) -> list[TopUserItem]:
        rows = db.execute(text("""
            SELECT u.id::text, u.full_name, u.role,
                   COUNT(DISTINCT qh.id) AS queries_run,
                   COUNT(DISTINCT du.id) AS uploads_done,
                   COUNT(DISTINCT aqs.id) AS ai_queries,
                   MAX(al.created_at) AS last_active
            FROM users u
            LEFT JOIN query_history qh ON qh.executed_by=u.id AND qh.executed_at>=NOW()-INTERVAL '30 days'
            LEFT JOIN data_uploads du ON du.uploaded_by=u.id AND du.created_at>=NOW()-INTERVAL '30 days'
            LEFT JOIN ai_query_sessions aqs ON aqs.user_id=u.id AND aqs.created_at>=NOW()-INTERVAL '30 days'
            LEFT JOIN audit_logs al ON al.user_id=u.id
            WHERE u.is_active=TRUE
            GROUP BY u.id,u.full_name,u.role
            ORDER BY (COUNT(DISTINCT qh.id)+COUNT(DISTINCT du.id)+COUNT(DISTINCT aqs.id)) DESC
            LIMIT :lim
        """), {"lim": limit}).fetchall()

        return [TopUserItem(id=r[0], full_name=r[1], role=r[2], queries_run=int(r[3] or 0), uploads_done=int(r[4] or 0), ai_queries=int(r[5] or 0), last_active_at=r[6]) for r in rows]

    # ------------------------------------------------------------------
    # 12. Save KPI snapshot
    # ------------------------------------------------------------------
    def save_kpi_snapshot(self, db: Session, data: KPISnapshotCreate) -> None:
        from app.models.kpi_snapshot import KPISnapshot
        snap = KPISnapshot(
            metric_name=data.metric_name, metric_value=data.metric_value,
            metric_unit=data.metric_unit, dimension=data.dimension,
            dimension_date=data.dimension_date, extra_metadata=data.metadata,
        )
        db.add(snap)
        db.commit()

    # ------------------------------------------------------------------
    # 13. Trigger daily snapshot
    # ------------------------------------------------------------------
    def trigger_daily_kpi_snapshot(self, db: Session) -> None:
        summary = self.get_kpi_summary(db)
        today = date.today()
        metrics = [
            ("queries_daily", summary.queries_today, "count"),
            ("upload_rows_daily", summary.rows_ingested_today, "rows"),
            ("ai_queries_daily", summary.ai_queries_today, "count"),
            ("ai_tokens_daily", summary.ai_tokens_today, "tokens"),
            ("active_users_daily", summary.active_users_today, "count"),
        ]
        for name, value, unit in metrics:
            self.save_kpi_snapshot(db, KPISnapshotCreate(
                metric_name=name, metric_value=float(value),
                metric_unit=unit, dimension="daily", dimension_date=today,
            ))
        logger.info("Daily KPI snapshot saved: %s", today.isoformat())


dashboard_service = DashboardService()
