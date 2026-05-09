"""
app/schemas/ai_query.py

Pydantic v2 request/response schemas for the AI Query Assistant.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class AIGenerateRequest(BaseModel):
    natural_language: str = Field(..., min_length=5, max_length=1000)
    session_group_id: str | None = None
    conversation_history: list[dict] = []
    include_schema: bool = True


class AIExecuteRequest(BaseModel):
    session_id: str


class AIAskRequest(BaseModel):
    natural_language: str = Field(..., min_length=5, max_length=1000)
    session_group_id: str | None = None
    conversation_history: list[dict] = []
    auto_execute: bool = False


class RateSessionRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    feedback: str | None = None


class SaveTemplateRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=255)
    description: str | None = None
    tags: list[str] = []


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class AIGenerateResponse(BaseModel):
    session_id: str
    session_group_id: str
    generated_sql: str | None
    explanation: str
    confidence: str
    tables_referenced: list[str] = []
    warnings: list[str] = []
    model_used: str
    total_tokens: int
    generation_ms: int

    model_config = {"from_attributes": True}


class AIAskResponse(BaseModel):
    session_id: str
    session_group_id: str
    natural_language: str
    generated_sql: str | None
    explanation: str
    confidence: str
    tables_referenced: list[str] = []
    warnings: list[str] = []
    was_executed: bool
    execution_status: str | None = None
    row_count: int = 0
    columns: list[dict] | None = None
    rows: list[dict] | None = None
    execution_ms: int | None = None
    error_message: str | None = None
    total_tokens: int
    generation_ms: int

    model_config = {"from_attributes": True}


class TableColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool
    is_primary_key: bool
    is_foreign_key: bool
    fk_references: str | None = None


class TableSchemaInfo(BaseModel):
    table_name: str
    columns: list[TableColumnInfo]
    row_count_estimate: int | None = None
    description: str | None = None


class SchemaContextResponse(BaseModel):
    tables: list[TableSchemaInfo]
    table_count: int
    total_columns: int
    last_refreshed: datetime
    schema_text_preview: str


class AISessionHistoryItem(BaseModel):
    id: str
    session_group_id: str | None
    turn_number: int
    natural_language: str
    generated_sql: str | None = None
    explanation: str | None = None
    confidence: str | None = None
    tables_referenced: list[str] = []
    warnings: list[str] = []
    execution_status: str | None = None
    row_count: int = 0
    execution_ms: int | None = None
    total_tokens: int = 0
    user_rating: int | None = None
    saved_as_template: bool = False
    was_executed: bool = False
    result_snapshot: list[dict] | None = None
    result_columns: list[dict] | None = None
    error_message: str | None = None
    executed_by_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SuggestionChip(BaseModel):
    label: str
    query: str
    category: str
