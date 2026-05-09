"""
app/schemas/upload.py

Pydantic v2 request / response schemas for the data ingestion endpoints.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Sub-schemas
# ---------------------------------------------------------------------------
class ColumnProfileSchema(BaseModel):
    """Statistics for a single column in an uploaded file."""

    column_name: str
    data_type: str
    null_count: int
    unique_count: int
    sample_values: list[Any]


class ValidationErrorSchema(BaseModel):
    """A single validation issue found during file parsing."""

    row: int | None = None
    column: str | None = None
    error_type: str  # "empty_file" | "too_many_columns" | "high_nulls" | "duplicate_rows" | "too_many_rows"
    message: str
    is_blocking: bool = False  # blocking errors prevent confirmation


# ---------------------------------------------------------------------------
# Upload flow schemas
# ---------------------------------------------------------------------------
class UploadInitResponse(BaseModel):
    """Returned immediately after parsing — before DB insertion."""

    upload_id: str
    file_name: str
    file_type: str
    file_size: int
    row_count: int
    column_count: int
    columns: list[ColumnProfileSchema]
    preview_data: list[dict]
    column_mapping: dict[str, str]
    validation_errors: list[ValidationErrorSchema]
    status: str


class UploadConfirmRequest(BaseModel):
    """User-confirmed column mapping before final DB insertion."""

    target_table: str = Field(..., pattern=r"^[a-z][a-z0-9_]{0,62}$")
    column_mapping: dict[str, str]


class UploadConfirmResponse(BaseModel):
    """Result after data has been inserted into the target table."""

    upload_id: str
    status: str
    rows_inserted: int
    target_table: str
    processing_ms: int
    message: str


# ---------------------------------------------------------------------------
# History / detail schemas
# ---------------------------------------------------------------------------
class UploadHistoryItem(BaseModel):
    """Summary row used in the upload history table."""

    id: uuid.UUID
    file_name: str
    file_type: str
    row_count: int
    column_count: int
    target_table: str
    status: str
    uploaded_by_name: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class UploadDetailResponse(BaseModel):
    """Full detail including column profiles and preview data."""

    id: uuid.UUID
    file_name: str
    file_type: str
    original_size: int | None
    row_count: int
    column_count: int
    target_table: str
    status: str
    validation_errors: list | None
    column_mapping: dict | None
    preview_data: list | None
    error_log: str | None
    processing_ms: int | None
    created_at: datetime
    completed_at: datetime | None
    columns: list[ColumnProfileSchema] = []

    model_config = {"from_attributes": True}
