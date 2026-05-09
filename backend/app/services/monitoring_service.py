"""
app/services/monitoring_service.py
System health monitoring service.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.models.ai_session import AIQuerySession
from app.models.audit import AuditLog, SystemHealthSnapshot
from app.models.query_history import QueryHistory
from app.models.upload import DataUpload
from app.models.user import User
from app.schemas.audit import SchedulerJobResponse, SystemHealthResponse

logger = get_logger(__name__)


class MonitoringService:
    def __init__(self):
        self.start_time = datetime.now(timezone.utc)

    def get_live_health(self, db: Session, scheduler=None) -> SystemHealthResponse:
        """Collects real-time metrics."""
        # CHECK 1 — DB connectivity
        try:
            db.execute(text("SELECT 1"))
            db_connected = True
        except Exception:
            db_connected = False

        # CHECK 2 — DB pool stats
        db_pool_size = None
        db_pool_checked_out = None
        try:
            pool = db.get_bind().pool
            if hasattr(pool, "size"):
                db_pool_size = pool.size()
            if hasattr(pool, "checkedout"):
                db_pool_checked_out = pool.checkedout()
        except Exception:
            pass

        # CHECK 3 — Platform counts
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)

        total_users = db.query(func.count(User.id)).scalar() or 0
        queries_last_hour = db.query(func.count(QueryHistory.id)).filter(QueryHistory.executed_at >= one_hour_ago).scalar() or 0
        uploads_last_hour = db.query(func.count(DataUpload.id)).filter(DataUpload.created_at >= one_hour_ago).scalar() or 0
        ai_queries_last_hour = db.query(func.count(AIQuerySession.id)).filter(AIQuerySession.created_at >= one_hour_ago).scalar() or 0
        failed_jobs_last_hour = db.query(func.count(AuditLog.id)).filter(
            AuditLog.status == "failure", AuditLog.created_at >= one_hour_ago
        ).scalar() or 0

        # CHECK 4 — Avg query execution time
        avg_query_ms = None
        try:
            avg_ms_row = db.execute(
                text(
                    "SELECT ROUND(AVG(execution_ms), 2) FROM query_history WHERE executed_at >= NOW() - INTERVAL '1 hour' AND status='success'"
                )
            ).fetchone()
            if avg_ms_row and avg_ms_row[0]:
                avg_query_ms = float(avg_ms_row[0])
        except Exception:
            pass

        # CHECK 5 — Error rate
        error_rate_pct = 0.0
        try:
            total_hour = queries_last_hour or 0
            failed_hour = db.query(func.count(QueryHistory.id)).filter(
                QueryHistory.executed_at >= one_hour_ago, QueryHistory.status == "failed"
            ).scalar() or 0
            if total_hour > 0:
                error_rate_pct = round((failed_hour / total_hour) * 100, 2)
        except Exception:
            pass

        # CHECK 6 — Scheduler
        scheduler_running = False
        scheduler_job_count = 0
        if scheduler:
            scheduler_running = scheduler.running
            scheduler_job_count = len(scheduler.get_jobs())

        # CHECK 7 — Overall status
        if not db_connected:
            status = "down"
        elif error_rate_pct > 20 or (
            db_pool_checked_out is not None and db_pool_size is not None and db_pool_size > 0 and (db_pool_checked_out / db_pool_size > 0.9)
        ):
            status = "degraded"
        else:
            status = "healthy"

        # CHECK 8 — Uptime
        delta = datetime.now(timezone.utc) - self.start_time
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, _ = divmod(remainder, 60)
        uptime_label = f"Running for {hours}h {minutes}m"

        return SystemHealthResponse(
            status=status,
            status_label={
                "healthy": "All Systems Operational",
                "degraded": "Performance Degraded",
                "down": "Service Unavailable",
            }[status],
            db_connected=db_connected,
            db_pool_size=db_pool_size,
            db_pool_checked_out=db_pool_checked_out,
            total_users=total_users,
            active_sessions=0,
            queries_last_hour=queries_last_hour,
            uploads_last_hour=uploads_last_hour,
            ai_queries_last_hour=ai_queries_last_hour,
            failed_jobs_last_hour=failed_jobs_last_hour,
            scheduler_running=scheduler_running,
            scheduler_job_count=scheduler_job_count,
            avg_query_ms=avg_query_ms,
            error_rate_pct=error_rate_pct,
            snapshot_at=datetime.now(timezone.utc),
            uptime_label=uptime_label,
        )

    def take_snapshot(self, db: Session, scheduler=None) -> None:
        """Writes a SystemHealthSnapshot to the DB."""
        try:
            health = self.get_live_health(db, scheduler)
            snap = SystemHealthSnapshot(
                db_connected=health.db_connected,
                db_pool_size=health.db_pool_size,
                db_pool_checked_out=health.db_pool_checked_out,
                total_users=health.total_users,
                active_sessions=health.active_sessions,
                queries_last_hour=health.queries_last_hour,
                uploads_last_hour=health.uploads_last_hour,
                ai_queries_last_hour=health.ai_queries_last_hour,
                failed_jobs_last_hour=health.failed_jobs_last_hour,
                scheduler_running=health.scheduler_running,
                scheduler_job_count=health.scheduler_job_count,
                avg_query_ms=health.avg_query_ms,
                error_rate_pct=health.error_rate_pct,
            )
            db.add(snap)
            db.commit()
            logger.debug("Health snapshot saved")
        except Exception as e:
            logger.error(f"Health snapshot failed: {str(e)}")

    def get_snapshots(self, db: Session, hours: int = 24) -> list[SystemHealthSnapshot]:
        """Fetch last N hours of snapshots."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        return (
            db.query(SystemHealthSnapshot)
            .filter(SystemHealthSnapshot.snapshot_at >= cutoff)
            .order_by(SystemHealthSnapshot.snapshot_at.asc())
            .all()
        )

    def get_scheduler_jobs(self, scheduler) -> list[SchedulerJobResponse]:
        """Returns status of all registered APScheduler jobs."""
        if not scheduler or not scheduler.running:
            return []

        jobs = []
        now = datetime.now(timezone.utc)
        for job in scheduler.get_jobs():
            next_run = job.next_run_time
            if next_run:
                if next_run.tzinfo is None:
                    next_run = next_run.replace(tzinfo=timezone.utc)
                delta = next_run - now
                secs = int(delta.total_seconds())
                if secs < 0:
                    next_run_label = "Pending..."
                elif secs < 60:
                    next_run_label = f"in {secs}s"
                elif secs < 3600:
                    next_run_label = f"in {secs // 60}m"
                else:
                    next_run_label = f"in {secs // 3600}h {(secs % 3600) // 60}m"
            else:
                next_run_label = "Paused"

            jobs.append(
                SchedulerJobResponse(
                    id=str(job.id),
                    name=job.name,
                    next_run_time=next_run,
                    next_run_label=next_run_label,
                    trigger=str(job.trigger),
                    is_running=(job.next_run_time is not None),
                )
            )
        return jobs


monitoring_service = MonitoringService()
