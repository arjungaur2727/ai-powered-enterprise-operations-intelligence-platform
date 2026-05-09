"""
app/services/workflow_service.py

Workflow management: create, update, toggle, and force-run scheduled SQL jobs.
Works in tandem with APScheduler via the scheduler module.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.models.scheduled_workflow import ScheduledWorkflow
from app.models.sql_template import SQLTemplate
from app.schemas.sql_template import SQLExecuteResponse, WorkflowCreate, WorkflowResponse, WorkflowUpdate

logger = get_logger(__name__)


def cron_to_human(expression: str) -> str:
    """
    Convert a 5-field cron expression into a plain-English description.
    Handles common patterns; falls back to raw expression for complex ones.
    """
    try:
        parts = expression.strip().split()
        if len(parts) != 5:
            return expression

        minute, hour, dom, month, dow = parts

        # Every N minutes
        if minute.startswith("*/") and hour == "*" and dom == "*" and month == "*" and dow == "*":
            n = minute[2:]
            return f"Every {n} minute{'s' if n != '1' else ''}"

        # Every N hours
        if minute == "0" and hour.startswith("*/") and dom == "*" and month == "*" and dow == "*":
            n = hour[2:]
            return f"Every {n} hour{'s' if n != '1' else ''}"

        # Daily at HH:MM
        if dom == "*" and month == "*" and dow == "*" and not hour.startswith("*/"):
            h = hour.zfill(2)
            m = minute.zfill(2)
            return f"Daily at {h}:{m} UTC"

        # Weekly on specific day
        days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        if dom == "*" and month == "*" and dow.isdigit() and int(dow) <= 6:
            day_name = days[int(dow)]
            h = hour.zfill(2)
            m = minute.zfill(2)
            return f"Every {day_name} at {h}:{m} UTC"

        # Monthly on day N
        if month == "*" and dow == "*" and dom.isdigit():
            h = hour.zfill(2)
            m = minute.zfill(2)
            suffix = {"1": "st", "2": "nd", "3": "rd"}.get(dom, "th")
            return f"On the {dom}{suffix} of every month at {h}:{m} UTC"

        # Every hour at minute N
        if hour == "*" and dom == "*" and month == "*" and dow == "*":
            return f"Every hour at minute {minute}"

        return expression
    except Exception:
        return expression


class WorkflowService:
    """Manages the lifecycle of scheduled SQL workflow jobs."""

    # ------------------------------------------------------------------
    # Cron validation
    # ------------------------------------------------------------------
    def validate_cron(self, expression: str) -> str:
        """
        Validate cron expression and return next run time ISO string.
        Raises HTTPException 400 if invalid.
        """
        try:
            from croniter import croniter

            if not croniter.is_valid(expression):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid cron expression: '{expression}'",
                )
            next_run = croniter(expression, datetime.now(timezone.utc)).get_next(datetime)
            return next_run.isoformat()
        except ImportError:
            # croniter not installed — skip validation
            logger.warning("croniter not installed — skipping cron validation")
            return datetime.now(timezone.utc).isoformat()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid cron expression: {exc}",
            )

    def _next_run(self, expression: str) -> datetime | None:
        try:
            from croniter import croniter
            return croniter(expression, datetime.now(timezone.utc)).get_next(datetime)
        except Exception:
            return None

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    def create_workflow(
        self,
        db: Session,
        data: WorkflowCreate,
        user_id: uuid.UUID,
    ) -> WorkflowResponse:
        # Validate template exists
        tmpl = (
            db.query(SQLTemplate)
            .filter(SQLTemplate.id == uuid.UUID(data.template_id), SQLTemplate.is_active == True)
            .first()
        )
        if not tmpl:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found.")

        self.validate_cron(data.cron_expression)
        next_run = self._next_run(data.cron_expression)

        wf = ScheduledWorkflow(
            name=data.name,
            description=data.description,
            template_id=tmpl.id,
            cron_expression=data.cron_expression,
            timezone=data.timezone,
            param_values=data.param_values,
            next_run_at=next_run,
            created_by=user_id,
        )
        db.add(wf)
        db.commit()
        db.refresh(wf)

        # Register in APScheduler
        try:
            from app.scheduler.scheduler import add_workflow_job
            add_workflow_job(wf)
        except Exception as exc:
            logger.warning("Could not register workflow in APScheduler: %s", exc)

        return self._to_response(wf, tmpl.name)

    def update_workflow(
        self,
        db: Session,
        workflow_id: uuid.UUID,
        data: WorkflowUpdate,
        current_user,
    ) -> WorkflowResponse:
        wf = self._get_or_404(db, workflow_id)

        if current_user.role != "admin" and wf.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

        if data.name is not None:
            wf.name = data.name
        if data.description is not None:
            wf.description = data.description
        if data.cron_expression is not None:
            self.validate_cron(data.cron_expression)
            wf.cron_expression = data.cron_expression
            wf.next_run_at = self._next_run(data.cron_expression)
            try:
                from app.scheduler.scheduler import reschedule_job
                reschedule_job(str(workflow_id), data.cron_expression)
            except Exception as exc:
                logger.warning("Reschedule failed: %s", exc)
        if data.timezone is not None:
            wf.timezone = data.timezone
        if data.param_values is not None:
            wf.param_values = data.param_values

        db.commit()
        db.refresh(wf)

        tmpl_name = wf.template.name if wf.template else None
        return self._to_response(wf, tmpl_name)

    def toggle_workflow(
        self, db: Session, workflow_id: uuid.UUID, current_user
    ) -> WorkflowResponse:
        wf = self._get_or_404(db, workflow_id)
        wf.is_active = not wf.is_active
        db.commit()
        db.refresh(wf)

        try:
            from app.scheduler.scheduler import pause_job, resume_job
            if wf.is_active:
                resume_job(str(workflow_id))
            else:
                pause_job(str(workflow_id))
        except Exception as exc:
            logger.warning("Scheduler toggle failed: %s", exc)

        tmpl_name = wf.template.name if wf.template else None
        return self._to_response(wf, tmpl_name)

    def run_workflow_now(
        self, db: Session, workflow_id: uuid.UUID, current_user
    ) -> SQLExecuteResponse:
        wf = self._get_or_404(db, workflow_id)
        tmpl = wf.template

        if not tmpl or not tmpl.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found or inactive.")

        from app.services.sql_service import sql_service
        return sql_service.execute_query(
            db=db,
            query_text=tmpl.query_text,
            params=wf.param_values or {},
            executed_by_id=current_user.id,
            source="scheduled",
            template_id=tmpl.id,
            workflow_id=wf.id,
        )

    def list_workflows(
        self,
        db: Session,
        current_user,
        skip: int = 0,
        limit: int = 20,
        is_active: bool | None = None,
    ) -> list[WorkflowResponse]:
        q = db.query(ScheduledWorkflow)
        if is_active is not None:
            q = q.filter(ScheduledWorkflow.is_active == is_active)
        workflows = q.order_by(ScheduledWorkflow.next_run_at.asc()).offset(skip).limit(limit).all()
        return [
            self._to_response(wf, wf.template.name if wf.template else None)
            for wf in workflows
        ]

    def delete_workflow(
        self, db: Session, workflow_id: uuid.UUID, current_user
    ) -> None:
        wf = self._get_or_404(db, workflow_id)
        try:
            from app.scheduler.scheduler import pause_job
            pause_job(str(workflow_id))
        except Exception:
            pass
        db.delete(wf)
        db.commit()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _get_or_404(self, db: Session, workflow_id: uuid.UUID) -> ScheduledWorkflow:
        wf = db.query(ScheduledWorkflow).filter(ScheduledWorkflow.id == workflow_id).first()
        if not wf:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")
        return wf

    def _to_response(
        self, wf: ScheduledWorkflow, template_name: str | None
    ) -> WorkflowResponse:
        return WorkflowResponse(
            id=str(wf.id),
            name=wf.name,
            description=wf.description,
            template_id=str(wf.template_id),
            template_name=template_name,
            cron_expression=wf.cron_expression,
            cron_human_readable=cron_to_human(wf.cron_expression),
            timezone=wf.timezone,
            is_active=wf.is_active,
            param_values=wf.param_values or {},
            last_run_at=wf.last_run_at,
            last_run_status=wf.last_run_status,
            next_run_at=wf.next_run_at,
            failure_count=wf.failure_count,
            created_at=wf.created_at,
        )


workflow_service = WorkflowService()
