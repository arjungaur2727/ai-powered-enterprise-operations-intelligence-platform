"""
app/scheduler/jobs.py

Standalone job entry points for APScheduler.
Re-exports execute_workflow_job for direct import by the scheduler.
"""

from app.scheduler.scheduler import execute_workflow_job, _cleanup_old_history  # noqa: F401

__all__ = ["execute_workflow_job", "_cleanup_old_history"]
