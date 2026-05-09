"""
app/routers/sql.py

SQL Automation Engine REST API.
Prefix: /api/v1/sql
Tags:   SQL Automation
"""

import io
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.logger import get_logger
from app.database import get_db
from app.models.query_history import QueryHistory
from app.models.scheduled_workflow import ScheduledWorkflow
from app.models.sql_template import SQLTemplate
from app.models.user import User
from app.schemas.sql_template import (
    QueryHistoryResponse,
    SQLExecuteRequest,
    SQLExecuteResponse,
    SQLTemplateCreate,
    SQLTemplateResponse,
    SQLTemplateUpdate,
    WorkflowCreate,
    WorkflowResponse,
    WorkflowUpdate,
    ColumnMeta,
)
from app.services.audit_service import audit_service
from app.services.sql_service import sql_service
from app.services.workflow_service import workflow_service

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/sql", tags=["SQL Automation"])


# ===========================================================================
# TEMPLATE ENDPOINTS
# ===========================================================================

@router.get("/templates", response_model=list[SQLTemplateResponse])
def list_templates(
    search: str | None = Query(None),
    tags: str | None = Query(None, description="Comma-separated tag filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SQLTemplateResponse]:
    """List SQL templates with optional search and tag filters."""
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    return sql_service.list_templates(db, current_user, search, tag_list, skip, limit)


@router.post("/templates", response_model=SQLTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    data: SQLTemplateCreate,
    request: Request,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> SQLTemplateResponse:
    """Create a new SQL template (Manager/Admin only)."""
    result = sql_service.create_template(db, data, current_user.id)
    audit_service.write_log(
        db,
        action="TEMPLATE_CREATED",
        user_id=current_user.id,
        entity_type="sql_template",
        entity_id=uuid.UUID(result.id),
        event_metadata={"name": result.name},
        ip_address=request.client.host if request.client else None,
    )
    return result


@router.get("/templates/{template_id}", response_model=SQLTemplateResponse)
def get_template(
    template_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SQLTemplateResponse:
    tmpl = sql_service.get_template_by_id(db, template_id)
    if current_user.role == "analyst" and not tmpl.is_public and tmpl.created_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    creator_name = tmpl.creator.full_name if tmpl.creator else None
    return SQLTemplateResponse(
        id=str(tmpl.id),
        name=tmpl.name,
        description=tmpl.description,
        query_text=tmpl.query_text,
        tags=tmpl.tags or [],
        is_public=tmpl.is_public,
        is_active=tmpl.is_active,
        param_schema=tmpl.param_schema,
        execution_count=tmpl.execution_count,
        last_executed_at=tmpl.last_executed_at,
        created_by_name=creator_name,
        created_at=tmpl.created_at,
        updated_at=tmpl.updated_at,
    )


@router.put("/templates/{template_id}", response_model=SQLTemplateResponse)
def update_template(
    template_id: uuid.UUID,
    data: SQLTemplateUpdate,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> SQLTemplateResponse:
    return sql_service.update_template(db, template_id, data, current_user)


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> dict:
    sql_service.delete_template(db, template_id, current_user)
    audit_service.write_log(
        db,
        action="TEMPLATE_DELETED",
        user_id=current_user.id,
        entity_type="sql_template",
        entity_id=template_id,
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "Template deactivated."}


# ===========================================================================
# EXECUTION ENDPOINTS
# ===========================================================================

@router.post("/execute", response_model=SQLExecuteResponse)
def execute_sql(
    body: SQLExecuteRequest,
    request: Request,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> SQLExecuteResponse:
    """Execute a SQL template or ad-hoc query."""
    template_id: uuid.UUID | None = None
    query_text: str

    if body.template_id:
        tmpl = sql_service.get_template_by_id(db, uuid.UUID(body.template_id))
        query_text = tmpl.query_text
        template_id = tmpl.id
    else:
        query_text = body.query_text  # type: ignore[assignment]

    result = sql_service.execute_query(
        db=db,
        query_text=query_text,
        params=body.params,
        executed_by_id=current_user.id,
        source="manual",
        template_id=template_id,
    )

    audit_service.write_log(
        db,
        action="SQL_EXECUTED",
        user_id=current_user.id,
        entity_type="query_history",
        entity_id=uuid.UUID(result.history_id),
        event_metadata={"rows": result.row_count, "ms": result.execution_ms, "status": result.status},
        ip_address=request.client.host if request.client else None,
    )
    return result


@router.post("/execute/raw", response_model=SQLExecuteResponse)
def execute_raw(
    body: dict,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> SQLExecuteResponse:
    """Execute raw SQL (Admin only). Every raw execution is logged at WARNING level."""
    query_text = body.get("query_text", "")
    if not query_text:
        raise HTTPException(status_code=400, detail="query_text is required.")
    logger.warning("RAW SQL executed by %s: %.200s", current_user.email, query_text)

    result = sql_service.execute_query(
        db=db,
        query_text=query_text,
        params={},
        executed_by_id=current_user.id,
        source="manual",
    )
    audit_service.write_log(
        db,
        action="RAW_SQL_EXECUTED",
        user_id=current_user.id,
        event_metadata={"rows": result.row_count, "status": result.status},
        ip_address=request.client.host if request.client else None,
    )
    return result


# ===========================================================================
# HISTORY ENDPOINTS
# ===========================================================================

@router.get("/history", response_model=list[QueryHistoryResponse])
def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    source: str | None = Query(None),
    hist_status: str | None = Query(None, alias="status"),
    template_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[QueryHistoryResponse]:
    q = db.query(QueryHistory)

    if current_user.role == "analyst":
        q = q.filter(QueryHistory.executed_by == current_user.id)
    if source:
        q = q.filter(QueryHistory.source == source)
    if hist_status:
        q = q.filter(QueryHistory.status == hist_status)
    if template_id:
        q = q.filter(QueryHistory.template_id == uuid.UUID(template_id))
    if date_from:
        q = q.filter(QueryHistory.executed_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        q = q.filter(QueryHistory.executed_at <= datetime.combine(date_to, datetime.max.time()))

    records = q.order_by(QueryHistory.executed_at.desc()).offset(skip).limit(limit).all()

    return [_history_to_response(h) for h in records]


@router.get("/history/{history_id}", response_model=QueryHistoryResponse)
def get_history_detail(
    history_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QueryHistoryResponse:
    h = db.query(QueryHistory).filter(QueryHistory.id == history_id).first()
    if not h:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")
    if current_user.role == "analyst" and h.executed_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
    return _history_to_response(h, include_snapshot=True)


@router.get("/history/{history_id}/export")
def export_history_csv(
    history_id: uuid.UUID,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    h = db.query(QueryHistory).filter(QueryHistory.id == history_id).first()
    if not h:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found.")

    csv_content = sql_service.history_to_csv(h)
    ts = datetime.now().strftime("%Y%m%d")
    filename = f"query_{str(history_id)[:8]}_{ts}.csv"

    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ===========================================================================
# WORKFLOW ENDPOINTS
# ===========================================================================

@router.get("/workflows", response_model=list[WorkflowResponse])
def list_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    is_active: bool | None = Query(None),
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> list[WorkflowResponse]:
    return workflow_service.list_workflows(db, current_user, skip, limit, is_active)


@router.post("/workflows", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
def create_workflow(
    data: WorkflowCreate,
    request: Request,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    result = workflow_service.create_workflow(db, data, current_user.id)
    audit_service.write_log(
        db,
        action="WORKFLOW_CREATED",
        user_id=current_user.id,
        entity_type="scheduled_workflow",
        entity_id=uuid.UUID(result.id),
        event_metadata={"name": result.name, "cron": result.cron_expression},
        ip_address=request.client.host if request.client else None,
    )
    return result


@router.put("/workflows/{workflow_id}", response_model=WorkflowResponse)
def update_workflow(
    workflow_id: uuid.UUID,
    data: WorkflowUpdate,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    return workflow_service.update_workflow(db, workflow_id, data, current_user)


@router.patch("/workflows/{workflow_id}/toggle", response_model=WorkflowResponse)
def toggle_workflow(
    workflow_id: uuid.UUID,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> WorkflowResponse:
    return workflow_service.toggle_workflow(db, workflow_id, current_user)


@router.delete("/workflows/{workflow_id}")
def delete_workflow(
    workflow_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> dict:
    workflow_service.delete_workflow(db, workflow_id, current_user)
    audit_service.write_log(
        db,
        action="WORKFLOW_DELETED",
        user_id=current_user.id,
        entity_type="scheduled_workflow",
        entity_id=workflow_id,
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "Workflow deleted."}


@router.post("/workflows/{workflow_id}/run-now", response_model=SQLExecuteResponse)
def run_workflow_now(
    workflow_id: uuid.UUID,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> SQLExecuteResponse:
    return workflow_service.run_workflow_now(db, workflow_id, current_user)


# ===========================================================================
# Helper
# ===========================================================================
def _history_to_response(h: QueryHistory, include_snapshot: bool = False) -> QueryHistoryResponse:
    result_cols = None
    if h.result_columns:
        result_cols = [ColumnMeta(name=c["name"], type=c["type"]) for c in h.result_columns]

    return QueryHistoryResponse(
        id=str(h.id),
        query_text=h.query_text,
        source=h.source,
        status=h.status,
        row_count=h.row_count,
        execution_ms=h.execution_ms,
        error_message=h.error_message,
        result_columns=result_cols,
        result_snapshot=h.result_snapshot if include_snapshot else None,
        template_name=h.template.name if h.template else None,
        workflow_name=h.workflow.name if h.workflow else None,
        executed_by_name=h.executor.full_name if h.executor else None,
        executed_at=h.executed_at,
    )
