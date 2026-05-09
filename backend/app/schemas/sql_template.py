"""
app/schemas/sql_template.py

Pydantic v2 request/response schemas for the SQL Automation Engine.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Sub-schemas
# ---------------------------------------------------------------------------
class ColumnMeta(BaseModel):
    """Metadata for a single result column."""
    name: str
    type: str  # string | integer | float | date | boolean


# ---------------------------------------------------------------------------
# Template schemas
# ---------------------------------------------------------------------------
class SQLTemplateCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    query_text: str = Field(..., min_length=10)
    tags: list[str] = []
    is_public: bool = False
    param_schema: dict | None = None


class SQLTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    query_text: str | None = None
    tags: list[str] | None = None
    is_public: bool | None = None
    is_active: bool | None = None
    param_schema: dict | None = None


class SQLTemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    query_text: str
    tags: list[str] = []
    is_public: bool
    is_active: bool
    param_schema: dict | None = None
    execution_count: int
    last_executed_at: datetime | None = None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Workflow schemas
# ---------------------------------------------------------------------------
class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    template_id: str
    cron_expression: str
    timezone: str = "UTC"
    param_values: dict = {}


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    cron_expression: str | None = None
    timezone: str | None = None
    param_values: dict | None = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    template_id: str
    template_name: str | None = None
    cron_expression: str
    cron_human_readable: str = ""
    timezone: str
    is_active: bool
    param_values: dict = {}
    last_run_at: datetime | None = None
    last_run_status: str | None = None
    next_run_at: datetime | None = None
    failure_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Execution schemas
# ---------------------------------------------------------------------------
class SQLExecuteRequest(BaseModel):
    template_id: str | None = None
    query_text: str | None = None
    params: dict[str, Any] = {}

    @model_validator(mode="after")
    def check_exactly_one_source(self) -> "SQLExecuteRequest":
        if not self.template_id and not self.query_text:
            raise ValueError("Provide either template_id or query_text.")
        if self.template_id and self.query_text:
            raise ValueError("Provide only one of template_id or query_text, not both.")
        return self


class SQLExecuteResponse(BaseModel):
    history_id: str
    status: str
    row_count: int
    execution_ms: int
    columns: list[ColumnMeta]
    rows: list[dict]
    query_text: str
    error_message: str | None = None


# ---------------------------------------------------------------------------
# History schemas
# ---------------------------------------------------------------------------
class QueryHistoryResponse(BaseModel):
    id: str
    query_text: str
    source: str
    status: str
    row_count: int
    execution_ms: int | None = None
    error_message: str | None = None
    result_columns: list[ColumnMeta] | None = None
    result_snapshot: list[dict] | None = None
    template_name: str | None = None
    workflow_name: str | None = None
    executed_by_name: str | None = None
    executed_at: datetime

    model_config = {"from_attributes": True}
