"""
app/services/sql_service.py

Core SQL execution and template management service.
Enforces SELECT-only safety, parameter substitution,
result serialization, and history recording.
"""

import csv
import io
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from time import perf_counter
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.models.query_history import QueryHistory
from app.models.sql_template import SQLTemplate
from app.schemas.sql_template import (
    ColumnMeta,
    QueryHistoryResponse,
    SQLExecuteResponse,
    SQLTemplateCreate,
    SQLTemplateResponse,
    SQLTemplateUpdate,
)

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
FORBIDDEN_KEYWORDS = [
    "DROP", "TRUNCATE", "DELETE", "ALTER", "CREATE",
    "INSERT", "UPDATE", "GRANT", "REVOKE", "EXEC", "--",
]
MAX_SNAPSHOT_ROWS = 100
QUERY_TIMEOUT_MS = 30_000  # 30 seconds


class SQLService:
    """Stateless SQL execution and template management service."""

    # ------------------------------------------------------------------
    # 1. Safety validation
    # ------------------------------------------------------------------
    def validate_query_safety(self, query: str) -> None:
        """
        Ensure the query is a pure SELECT statement with no destructive ops.

        Raises:
            HTTPException 400: If forbidden keywords are found or query is not SELECT.
        """
        upper = query.upper()

        for keyword in FORBIDDEN_KEYWORDS:
            pattern = rf"\b{re.escape(keyword)}\b"
            if re.search(pattern, upper):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Query contains forbidden operation: {keyword}. Only SELECT statements are allowed.",
                )

        stripped = query.strip()
        if not stripped.upper().startswith("SELECT"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only SELECT queries are permitted.",
            )

        if ";" in query and query.index(";") < len(query) - 1:
            logger.warning("Query contains multiple statements (semicolon detected).")

    # ------------------------------------------------------------------
    # 2. Parameter substitution
    # ------------------------------------------------------------------
    def substitute_params(self, query: str, params: dict[str, Any]) -> str:
        """
        Replace :param_name placeholders with escaped literal values.
        """
        if not params:
            return query

        placeholders = re.findall(r":([a-zA-Z_][a-zA-Z0-9_]*)", query)
        result = query

        for name in placeholders:
            if name not in params:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing parameter: '{name}'",
                )
            val = params[name]
            if isinstance(val, str):
                safe_val = f"'{val.replace(chr(39), chr(39)*2)}'"
            elif isinstance(val, bool):
                safe_val = "TRUE" if val else "FALSE"
            elif val is None:
                safe_val = "NULL"
            else:
                safe_val = str(val)
            result = re.sub(rf":{re.escape(name)}\b", safe_val, result)

        logger.info("Query parameters substituted: %s", list(params.keys()))
        return result

    # ------------------------------------------------------------------
    # 3. Column type inference
    # ------------------------------------------------------------------
    def _infer_type(self, value: Any) -> str:
        if isinstance(value, bool):
            return "boolean"
        if isinstance(value, int):
            return "integer"
        if isinstance(value, float) or isinstance(value, Decimal):
            return "float"
        if isinstance(value, datetime):
            return "date"
        return "string"

    def infer_column_types(
        self, cursor_keys: list[str], rows: list
    ) -> list[ColumnMeta]:
        """Build ColumnMeta list by inspecting first non-null value per column."""
        type_map: dict[str, str] = {k: "string" for k in cursor_keys}

        for row in rows[:20]:
            row_dict = dict(zip(cursor_keys, row)) if not hasattr(row, "_mapping") else dict(row._mapping)
            for col, val in row_dict.items():
                if val is not None and type_map.get(col) == "string":
                    type_map[col] = self._infer_type(val)

        return [ColumnMeta(name=k, type=type_map[k]) for k in cursor_keys]

    # ------------------------------------------------------------------
    # 4. Row serialization
    # ------------------------------------------------------------------
    def serialize_rows(
        self, rows: list, cursor_keys: list[str]
    ) -> list[dict]:
        """Convert DB rows to JSON-safe dicts."""
        result = []
        for row in rows:
            row_dict = dict(zip(cursor_keys, row)) if not hasattr(row, "_mapping") else dict(row._mapping)
            serialized: dict[str, Any] = {}
            for k, v in row_dict.items():
                if v is None:
                    serialized[k] = None
                elif isinstance(v, datetime):
                    serialized[k] = v.isoformat()
                elif isinstance(v, Decimal):
                    serialized[k] = float(v)
                elif isinstance(v, uuid.UUID):
                    serialized[k] = str(v)
                elif isinstance(v, (bytes, bytearray)):
                    serialized[k] = v.hex()
                else:
                    serialized[k] = v
            result.append(serialized)
        return result

    # ------------------------------------------------------------------
    # 5. Execute query
    # ------------------------------------------------------------------
    def execute_query(
        self,
        db: Session,
        query_text: str,
        params: dict[str, Any],
        executed_by_id: uuid.UUID | None,
        source: str,
        template_id: uuid.UUID | None = None,
        workflow_id: uuid.UUID | None = None,
    ) -> SQLExecuteResponse:
        """
        Validate, substitute params, execute, record history, and return results.
        """
        self.validate_query_safety(query_text)
        final_query = self.substitute_params(query_text, params)

        history_id = uuid.uuid4()
        status_val = "failed"
        error_message: str | None = None
        rows_data: list[dict] = []
        columns: list[ColumnMeta] = []
        row_count = 0
        elapsed_ms = 0

        start = perf_counter()
        try:
            # Set statement timeout for safety
            db.execute(text(f"SET statement_timeout = '{QUERY_TIMEOUT_MS}'"))
            result = db.execute(text(final_query))
            all_rows = result.fetchall()
            cursor_keys = list(result.keys())

            row_count = len(all_rows)
            columns = self.infer_column_types(cursor_keys, all_rows)
            snapshot_rows = all_rows[:MAX_SNAPSHOT_ROWS]
            rows_data = self.serialize_rows(snapshot_rows, cursor_keys)
            status_val = "success"

            logger.info(
                "Query executed: source=%s rows=%d template=%s",
                source, row_count, template_id,
            )
        except Exception as exc:
            error_message = str(exc)[:2000]
            logger.error("Query execution failed: %s", exc)
            db.rollback()
        finally:
            elapsed_ms = int((perf_counter() - start) * 1000)

        # Audit logging
        from app.services.audit_service import audit_service
        user_email = None
        user_role = None
        if executed_by_id:
            from app.models.user import User
            user = db.query(User).filter(User.id == executed_by_id).first()
            if user:
                user_email = user.email
                user_role = user.role

        audit_service.write_log(
            db,
            action="QUERY_EXECUTED" if status_val == "success" else "QUERY_FAILED",
            user_id=executed_by_id,
            user_email=user_email,
            user_role=user_role,
            entity_type="query",
            entity_id=template_id,
            entity_name="Ad-hoc Query" if not template_id else None,
            status=status_val,
            duration_ms=elapsed_ms,
            event_metadata={
                "rows_returned": row_count,
                "query_length": len(query_text),
                "source": source,
                "template_id": str(template_id) if template_id else None,
            },
            error_message=error_message,
        )

        # Persist history record
        history = QueryHistory(
            id=history_id,
            executed_by=executed_by_id,
            template_id=template_id,
            workflow_id=workflow_id,
            query_text=final_query[:5000],
            source=source,
            status=status_val,
            row_count=row_count,
            execution_ms=elapsed_ms,
            error_message=error_message,
            result_snapshot=[dict(r) for r in rows_data] if rows_data else None,
            result_columns=[c.model_dump() for c in columns] if columns else None,
        )
        db.add(history)

        # Update template stats
        if template_id and status_val == "success":
            tmpl = db.query(SQLTemplate).filter(SQLTemplate.id == template_id).first()
            if tmpl:
                tmpl.execution_count = (tmpl.execution_count or 0) + 1
                tmpl.last_executed_at = datetime.now(timezone.utc)

        # Handle scheduled workflow failures
        if source == "scheduled" and status_val == "failed" and workflow_id:
            self._handle_workflow_failure(db, workflow_id)

        db.commit()

        return SQLExecuteResponse(
            history_id=str(history_id),
            status=status_val,
            row_count=row_count,
            execution_ms=elapsed_ms,
            columns=columns,
            rows=rows_data,
            query_text=final_query,
            error_message=error_message,
        )

    def _handle_workflow_failure(
        self, db: Session, workflow_id: uuid.UUID
    ) -> None:
        """Increment failure count; auto-disable after 3 consecutive failures."""
        from app.models.scheduled_workflow import ScheduledWorkflow

        wf = db.query(ScheduledWorkflow).filter(ScheduledWorkflow.id == workflow_id).first()
        if not wf:
            return
        wf.failure_count = (wf.failure_count or 0) + 1
        if wf.failure_count >= 3:
            wf.is_active = False
            logger.warning(
                "Workflow '%s' auto-disabled after %d consecutive failures.",
                wf.name, wf.failure_count,
            )

    # ------------------------------------------------------------------
    # 6–10. Template CRUD
    # ------------------------------------------------------------------
    def get_template_by_id(
        self, db: Session, template_id: uuid.UUID
    ) -> SQLTemplate:
        tmpl = (
            db.query(SQLTemplate)
            .filter(SQLTemplate.id == template_id, SQLTemplate.is_active == True)
            .first()
        )
        if not tmpl:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="SQL template not found.",
            )
        return tmpl

    def list_templates(
        self,
        db: Session,
        current_user,
        search: str | None = None,
        tags: list[str] | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> list[SQLTemplateResponse]:
        q = db.query(SQLTemplate).filter(SQLTemplate.is_active == True)

        if current_user.role == "analyst":
            q = q.filter(
                (SQLTemplate.is_public == True) | (SQLTemplate.created_by == current_user.id)
            )

        if search:
            q = q.filter(
                SQLTemplate.name.ilike(f"%{search}%")
                | SQLTemplate.description.ilike(f"%{search}%")
            )

        if tags:
            q = q.filter(SQLTemplate.tags.overlap(tags))

        templates = q.order_by(SQLTemplate.execution_count.desc()).offset(skip).limit(limit).all()

        result = []
        for t in templates:
            creator_name = t.creator.full_name if t.creator else None
            result.append(
                SQLTemplateResponse(
                    id=str(t.id),
                    name=t.name,
                    description=t.description,
                    query_text=t.query_text,
                    tags=t.tags or [],
                    is_public=t.is_public,
                    is_active=t.is_active,
                    param_schema=t.param_schema,
                    execution_count=t.execution_count,
                    last_executed_at=t.last_executed_at,
                    created_by_name=creator_name,
                    created_at=t.created_at,
                    updated_at=t.updated_at,
                )
            )
        return result

    def create_template(
        self, db: Session, data: SQLTemplateCreate, user_id: uuid.UUID
    ) -> SQLTemplateResponse:
        self.validate_query_safety(data.query_text)

        existing = (
            db.query(SQLTemplate)
            .filter(SQLTemplate.name == data.name, SQLTemplate.created_by == user_id, SQLTemplate.is_active == True)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A template named '{data.name}' already exists.",
            )

        tmpl = SQLTemplate(
            name=data.name,
            description=data.description,
            query_text=data.query_text,
            created_by=user_id,
            is_public=data.is_public,
            tags=data.tags or [],
            param_schema=data.param_schema,
        )
        db.add(tmpl)
        db.commit()
        db.refresh(tmpl)

        # Audit log
        from app.services.audit_service import audit_service
        audit_service.write_log(
            db,
            action="WORKFLOW_CREATED",
            user_id=user_id,
            entity_type="workflow",
            entity_id=tmpl.id,
            entity_name=tmpl.name,
            event_metadata={"is_public": tmpl.is_public, "tags": tmpl.tags},
        )

        return SQLTemplateResponse(
            id=str(tmpl.id),
            name=tmpl.name,
            description=tmpl.description,
            query_text=tmpl.query_text,
            tags=tmpl.tags or [],
            is_public=tmpl.is_public,
            is_active=tmpl.is_active,
            param_schema=tmpl.param_schema,
            execution_count=0,
            last_executed_at=None,
            created_by_name=None,
            created_at=tmpl.created_at,
            updated_at=tmpl.updated_at,
        )

    def update_template(
        self,
        db: Session,
        template_id: uuid.UUID,
        data: SQLTemplateUpdate,
        current_user,
    ) -> SQLTemplateResponse:
        tmpl = self.get_template_by_id(db, template_id)

        if current_user.role != "admin" and tmpl.created_by != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this template.")

        if data.query_text is not None:
            self.validate_query_safety(data.query_text)
            tmpl.query_text = data.query_text
        if data.name is not None:
            tmpl.name = data.name
        if data.description is not None:
            tmpl.description = data.description
        if data.tags is not None:
            tmpl.tags = data.tags
        if data.is_public is not None:
            tmpl.is_public = data.is_public
        if data.is_active is not None:
            tmpl.is_active = data.is_active
        if data.param_schema is not None:
            tmpl.param_schema = data.param_schema

        db.commit()
        db.refresh(tmpl)

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

    def delete_template(
        self, db: Session, template_id: uuid.UUID, current_user
    ) -> None:
        tmpl = self.get_template_by_id(db, template_id)
        tmpl.is_active = False
        db.commit()
        logger.info("Template '%s' soft-deleted by %s", tmpl.name, current_user.email)

        # Audit log
        from app.services.audit_service import audit_service
        audit_service.write_log(
            db,
            action="WORKFLOW_DELETED",
            user_id=current_user.id,
            user_email=current_user.email,
            user_role=current_user.role,
            entity_type="workflow",
            entity_id=template_id,
            entity_name=tmpl.name,
            status="success",
        )

    # ------------------------------------------------------------------
    # CSV export helper
    # ------------------------------------------------------------------
    def history_to_csv(self, history: QueryHistory) -> str:
        """Serialize a query history result_snapshot to CSV string."""
        rows = history.result_snapshot or []
        cols = [c["name"] for c in (history.result_columns or [])]

        if not cols and rows:
            cols = list(rows[0].keys())

        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        return buf.getvalue()


sql_service = SQLService()
