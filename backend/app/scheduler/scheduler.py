"""
app/scheduler/scheduler.py

APScheduler singleton with PostgreSQL jobstore.
Manages all cron-based SQL workflow executions.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Scheduler instance
# ---------------------------------------------------------------------------
_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    """Return the global scheduler instance, creating it if necessary."""
    global _scheduler
    if _scheduler is None:
        try:
            from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
            jobstores = {
                "default": SQLAlchemyJobStore(url=settings.DATABASE_URL)
            }
        except Exception as exc:
            logger.warning("Could not set up PostgreSQL jobstore: %s. Using memory store.", exc)
            jobstores = {}

        _scheduler = BackgroundScheduler(
            jobstores=jobstores,
            job_defaults={"max_instances": 1, "coalesce": True},
            timezone="UTC",
        )
    return _scheduler


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------
def start_scheduler() -> None:
    """Start APScheduler and load all active workflows from the database."""
    sched = get_scheduler()
    if not sched.running:
        sched.start()
        logger.info("APScheduler started with PostgreSQL jobstore.")

    # Register daily history cleanup job
    if not sched.get_job("cleanup_old_history"):
        sched.add_job(
            _cleanup_old_history,
            trigger=CronTrigger(hour=0, minute=0),
            id="cleanup_old_history",
            name="Cleanup Old Query History",
            replace_existing=True,
        )

    if not sched.get_job("daily_kpi_snapshot"):
        sched.add_job(
            _daily_kpi_snapshot_job,
            trigger=CronTrigger(hour=0, minute=5),
            id="daily_kpi_snapshot",
            name="Daily KPI Snapshot",
            replace_existing=True,
        )

    if not sched.get_job("threshold_monitor"):
        sched.add_job(
            _run_threshold_checks_job,
            trigger=CronTrigger(minute="*/15"),
            id="threshold_monitor",
            name="Threshold Monitor",
            replace_existing=True,
            max_instances=1,
        )

    if not sched.get_job("health_monitor"):
        sched.add_job(
            _run_health_snapshot_job,
            trigger=CronTrigger(minute="*/5"),
            id="health_monitor",
            name="System Health Monitor",
            replace_existing=True,
            max_instances=1,
        )

    _load_existing_workflows()



def shutdown_scheduler() -> None:
    """Gracefully stop APScheduler."""
    sched = get_scheduler()
    if sched.running:
        sched.shutdown(wait=False)
        logger.info("APScheduler stopped.")


# ---------------------------------------------------------------------------
# Job functions
# ---------------------------------------------------------------------------
def execute_workflow_job(workflow_id: str) -> None:
    """
    Called by APScheduler at cron time.
    Opens its own DB session — never reuses the app's request session.
    """
    from app.database import SessionLocal
    from app.models.scheduled_workflow import ScheduledWorkflow
    from app.services.sql_service import sql_service
    from datetime import datetime, timezone

    db = SessionLocal()
    try:
        from croniter import croniter

        wf = db.query(ScheduledWorkflow).filter(
            ScheduledWorkflow.id == workflow_id
        ).first()

        if not wf or not wf.is_active or not wf.template:
            logger.warning("Workflow %s not found or inactive — skipping.", workflow_id)
            return

        logger.info("Executing scheduled workflow: %s", wf.name)

        result = sql_service.execute_query(
            db=db,
            query_text=wf.template.query_text,
            params=wf.param_values or {},
            executed_by_id=None,
            source="scheduled",
            template_id=wf.template_id,
            workflow_id=wf.id,
        )

        wf.last_run_at = datetime.now(timezone.utc)
        wf.last_run_status = result.status
        if result.status == "success":
            wf.failure_count = 0

        try:
            next_run = croniter(wf.cron_expression, datetime.now(timezone.utc)).get_next(datetime)
            wf.next_run_at = next_run
        except Exception:
            pass

        db.commit()

        logger.info(
            "Workflow '%s' executed: status=%s rows=%d ms=%d",
            wf.name, result.status, result.row_count, result.execution_ms,
        )
    except Exception as exc:
        logger.error("Scheduled workflow %s failed with exception: %s", workflow_id, exc)
    finally:
        db.close()


def _cleanup_old_history() -> None:
    """Delete query_history records older than 90 days."""
    from app.database import SessionLocal
    from app.models.query_history import QueryHistory
    from datetime import timedelta, timezone, datetime
    from sqlalchemy import text

    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        deleted = db.query(QueryHistory).filter(QueryHistory.executed_at < cutoff).delete()
        db.commit()
        logger.info("Pruned %d query history records older than 90 days.", deleted)
    except Exception as exc:
        logger.error("History cleanup failed: %s", exc)
    finally:
        db.close()


def _daily_kpi_snapshot_job() -> None:
    """Save daily KPI snapshot metrics at 00:05 UTC."""
    from app.database import SessionLocal
    from app.services.dashboard_service import dashboard_service
    db = SessionLocal()
    try:
        dashboard_service.trigger_daily_kpi_snapshot(db)
        logger.info("Daily KPI snapshot job completed.")
    except Exception as exc:
        logger.error("Daily KPI snapshot job failed: %s", exc)
    finally:
        db.close()


def _run_threshold_checks_job() -> None:
    """Evaluate all active alert rules every 15 minutes."""
    from app.database import SessionLocal
    from app.services.threshold_monitor import threshold_monitor
    db = SessionLocal()
    try:
        count = threshold_monitor.run_checks(db)
        logger.info("Threshold monitor: %d alerts triggered.", count)
    except Exception as exc:
        logger.error("Threshold monitor job failed: %s", exc)
    finally:
        db.close()


def _run_health_snapshot_job() -> None:
    """Save a platform health snapshot every 5 minutes."""
    from app.database import SessionLocal
    from app.services.monitoring_service import monitoring_service
    db = SessionLocal()
    try:
        from app.scheduler.scheduler import get_scheduler
        sched = get_scheduler()
        monitoring_service.take_snapshot(db, sched)
    except Exception as exc:
        logger.error("Health snapshot job failed: %s", exc)
    finally:
        db.close()



# ---------------------------------------------------------------------------
# Job management helpers
# ---------------------------------------------------------------------------
def add_workflow_job(workflow) -> None:
    """Register or replace a workflow's APScheduler job."""
    sched = get_scheduler()
    parts = workflow.cron_expression.strip().split()
    if len(parts) != 5:
        logger.warning("Invalid cron expression '%s' for workflow %s", workflow.cron_expression, workflow.id)
        return

    minute, hour, day, month, day_of_week = parts

    trigger = CronTrigger(
        minute=minute,
        hour=hour,
        day=day,
        month=month,
        day_of_week=day_of_week,
        timezone=workflow.timezone or "UTC",
    )

    sched.add_job(
        execute_workflow_job,
        trigger=trigger,
        args=[str(workflow.id)],
        id=str(workflow.id),
        name=workflow.name,
        replace_existing=True,
    )
    logger.info("Registered APScheduler job for workflow: %s", workflow.name)


def pause_job(workflow_id: str) -> None:
    """Pause a scheduled workflow job."""
    sched = get_scheduler()
    try:
        sched.pause_job(workflow_id)
        logger.info("Paused scheduler job: %s", workflow_id)
    except Exception as exc:
        logger.warning("Could not pause job %s: %s", workflow_id, exc)


def resume_job(workflow_id: str) -> None:
    """Resume a paused workflow job."""
    sched = get_scheduler()
    try:
        sched.resume_job(workflow_id)
        logger.info("Resumed scheduler job: %s", workflow_id)
    except Exception as exc:
        logger.warning("Could not resume job %s — attempting re-add: %s", workflow_id, exc)
        # Re-add from DB
        try:
            from app.database import SessionLocal
            from app.models.scheduled_workflow import ScheduledWorkflow
            db = SessionLocal()
            wf = db.query(ScheduledWorkflow).filter(ScheduledWorkflow.id == workflow_id).first()
            if wf:
                add_workflow_job(wf)
            db.close()
        except Exception as exc2:
            logger.error("Re-add job failed: %s", exc2)


def reschedule_job(workflow_id: str, new_cron: str) -> None:
    """Remove and re-add a workflow job with a new cron expression."""
    sched = get_scheduler()
    try:
        sched.remove_job(workflow_id)
    except Exception:
        pass

    try:
        from app.database import SessionLocal
        from app.models.scheduled_workflow import ScheduledWorkflow
        db = SessionLocal()
        wf = db.query(ScheduledWorkflow).filter(ScheduledWorkflow.id == workflow_id).first()
        if wf:
            add_workflow_job(wf)
        db.close()
    except Exception as exc:
        logger.error("Reschedule job %s failed: %s", workflow_id, exc)


def _load_existing_workflows() -> None:
    """Load all active workflows from DB into APScheduler on startup."""
    try:
        from app.database import SessionLocal
        from app.models.scheduled_workflow import ScheduledWorkflow
        db = SessionLocal()
        workflows = db.query(ScheduledWorkflow).filter(ScheduledWorkflow.is_active == True).all()
        for wf in workflows:
            try:
                add_workflow_job(wf)
            except Exception as exc:
                logger.warning("Could not load workflow '%s': %s", wf.name, exc)
        db.close()
        logger.info("Loaded %d scheduled workflows into APScheduler.", len(workflows))
    except Exception as exc:
        logger.error("Failed to load existing workflows: %s", exc)
