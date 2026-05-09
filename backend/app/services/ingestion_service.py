"""
app/services/ingestion_service.py

Core data ingestion business logic:
  - File parsing (CSV / Excel)
  - Column profiling
  - Data quality validation
  - Column name sanitization
  - Parquet temp caching (parse once, insert later)
  - Dynamic PostgreSQL table insertion via pandas to_sql
"""

import os
import re
import uuid
from datetime import datetime, timezone
from time import perf_counter
from typing import Any

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.database import engine
from app.models.upload import DataUpload, UploadColumnProfile
from app.schemas.upload import ColumnProfileSchema, ValidationErrorSchema

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024   # 50 MB
MAX_COLUMNS = 100
MAX_ROWS = 500_000
PROFILE_SAMPLE_ROWS = 1_000              # profile only first N rows for speed
CHUNK_SIZE = 1_000                       # pandas to_sql chunksize
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "tmp_uploads")


def _ensure_temp_dir() -> None:
    os.makedirs(TEMP_DIR, exist_ok=True)


def _temp_path(upload_id: str | uuid.UUID) -> str:
    _ensure_temp_dir()
    return os.path.join(TEMP_DIR, f"{upload_id}.parquet")


class IngestionService:
    """Stateless service — all state is passed via arguments or persisted to DB."""

    # ------------------------------------------------------------------
    # 1. File Parsing
    # ------------------------------------------------------------------
    async def parse_file(
        self, file: UploadFile
    ) -> tuple[pd.DataFrame, str, int]:
        """
        Read the uploaded file into a Pandas DataFrame.

        Args:
            file: FastAPI UploadFile object.

        Returns:
            Tuple of (DataFrame, detected_file_type, file_size_bytes).

        Raises:
            HTTPException 400: Unsupported file type.
            HTTPException 413: File too large.
        """
        filename = file.filename or ""
        ext = os.path.splitext(filename)[-1].lower().lstrip(".")

        if ext not in {"csv", "xlsx", "xls"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '.{ext}'. Only CSV and Excel files are accepted.",
            )

        raw = await file.read()
        file_size = len(raw)

        if file_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large ({file_size / 1024 / 1024:.1f} MB). Maximum allowed is 50 MB.",
            )

        import io

        try:
            if ext == "csv":
                file_type = "csv"
                try:
                    df = pd.read_csv(io.BytesIO(raw), encoding="utf-8", low_memory=False)
                except UnicodeDecodeError:
                    df = pd.read_csv(io.BytesIO(raw), encoding="latin-1", low_memory=False)
            else:
                file_type = "xlsx"
                df = pd.read_excel(io.BytesIO(raw), engine="openpyxl")
        except Exception as exc:
            logger.error("Failed to parse file %s: %s", filename, exc)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Could not parse file: {exc}",
            ) from exc

        # Normalize column names
        df.columns = [str(c).strip() for c in df.columns]
        df.reset_index(drop=True, inplace=True)

        logger.info("Parsed file %s — %d rows, %d cols", filename, len(df), len(df.columns))
        return df, file_type, file_size

    # ------------------------------------------------------------------
    # 2. Column Profiling
    # ------------------------------------------------------------------
    def profile_columns(self, df: pd.DataFrame) -> list[ColumnProfileSchema]:
        """
        Compute per-column statistics on the first PROFILE_SAMPLE_ROWS rows.

        Returns:
            List of ColumnProfileSchema objects.
        """
        sample = df.head(PROFILE_SAMPLE_ROWS)
        profiles: list[ColumnProfileSchema] = []

        for col in sample.columns:
            dtype = sample[col].dtype
            if pd.api.types.is_integer_dtype(dtype):
                data_type = "integer"
            elif pd.api.types.is_float_dtype(dtype):
                data_type = "float"
            elif pd.api.types.is_datetime64_any_dtype(dtype):
                data_type = "date"
            elif pd.api.types.is_bool_dtype(dtype):
                data_type = "boolean"
            else:
                data_type = "string"

            null_count = int(sample[col].isnull().sum())
            unique_count = int(sample[col].nunique())
            sample_vals: list[Any] = (
                sample[col].dropna().unique()[:5].tolist()
            )
            # Convert numpy scalars to Python native for JSON safety
            sample_vals = [
                v.item() if hasattr(v, "item") else v for v in sample_vals
            ]

            profiles.append(
                ColumnProfileSchema(
                    column_name=col,
                    data_type=data_type,
                    null_count=null_count,
                    unique_count=unique_count,
                    sample_values=sample_vals,
                )
            )

        return profiles

    # ------------------------------------------------------------------
    # 3. Validation
    # ------------------------------------------------------------------
    def validate_dataframe(
        self, df: pd.DataFrame
    ) -> list[ValidationErrorSchema]:
        """
        Apply quality checks and return a list of errors/warnings.

        Blocking errors have is_blocking=True; warnings are non-blocking.
        """
        errors: list[ValidationErrorSchema] = []

        if df.empty:
            errors.append(
                ValidationErrorSchema(
                    error_type="empty_file",
                    message="The file contains no data rows.",
                    is_blocking=True,
                )
            )
            return errors

        if len(df.columns) > MAX_COLUMNS:
            errors.append(
                ValidationErrorSchema(
                    error_type="too_many_columns",
                    message=f"File has {len(df.columns)} columns; maximum allowed is {MAX_COLUMNS}.",
                    is_blocking=True,
                )
            )

        if len(df) > MAX_ROWS:
            errors.append(
                ValidationErrorSchema(
                    error_type="too_many_rows",
                    message=f"File has {len(df):,} rows; maximum allowed is {MAX_ROWS:,}.",
                    is_blocking=True,
                )
            )

        for col in df.columns:
            null_pct = df[col].isnull().mean() * 100
            if null_pct > 80:
                errors.append(
                    ValidationErrorSchema(
                        column=col,
                        error_type="high_nulls",
                        message=f"Column '{col}' is {null_pct:.0f}% empty.",
                        is_blocking=False,
                    )
                )

        dup_count = int(df.duplicated().sum())
        if dup_count > 0:
            errors.append(
                ValidationErrorSchema(
                    error_type="duplicate_rows",
                    message=f"{dup_count:,} completely duplicate row(s) detected.",
                    is_blocking=False,
                )
            )

        return errors

    # ------------------------------------------------------------------
    # 4 & 5. Column Name Sanitization + Mapping
    # ------------------------------------------------------------------
    def sanitize_column_name(self, col: str) -> str:
        """
        Convert an arbitrary column header into a safe PostgreSQL column name.
        """
        s = col.lower()
        s = re.sub(r"[^a-z0-9]+", "_", s)
        s = s.strip("_")
        if not s:
            s = "col"
        if s[0].isdigit():
            s = f"col_{s}"
        return s[:63]

    def generate_column_mapping(self, df: pd.DataFrame) -> dict[str, str]:
        """
        Build a mapping {original_col: sanitized_col} with duplicate handling.
        """
        mapping: dict[str, str] = {}
        seen: dict[str, int] = {}

        for col in df.columns:
            sanitized = self.sanitize_column_name(col)
            if sanitized in seen:
                seen[sanitized] += 1
                sanitized = f"{sanitized}_{seen[sanitized]}"
            else:
                seen[sanitized] = 1
            mapping[col] = sanitized

        return mapping

    # ------------------------------------------------------------------
    # 6. Persist parsed upload record + temp parquet
    # ------------------------------------------------------------------
    def store_parsed_upload(
        self,
        db: Session,
        df: pd.DataFrame,
        file_name: str,
        file_type: str,
        file_size: int,
        profiles: list[ColumnProfileSchema],
        validation_errors: list[ValidationErrorSchema],
        column_mapping: dict[str, str],
        user_id: uuid.UUID,
        target_table: str,
        upload_id: uuid.UUID,
    ) -> DataUpload:
        """
        Persist a DataUpload record and column profiles to the database.
        Also saves a temp parquet file for later confirmation step.
        """
        # Prepare preview — replace NaN with None for JSON safety
        preview_df = df.head(10).where(pd.notnull(df.head(10)), other=None)
        # Convert datetime columns to ISO strings
        for col in preview_df.select_dtypes(include=["datetime", "datetimetz"]).columns:
            preview_df[col] = preview_df[col].astype(str)
        preview_data = preview_df.to_dict("records")

        errors_json = [e.model_dump() for e in validation_errors]

        upload = DataUpload(
            id=upload_id,
            uploaded_by=user_id,
            file_name=file_name,
            file_type=file_type,
            original_size=file_size,
            row_count=len(df),
            column_count=len(df.columns),
            target_table=target_table,
            status="pending",
            validation_errors=errors_json,
            column_mapping=column_mapping,
            preview_data=preview_data,
        )
        db.add(upload)
        db.flush()  # get id without full commit

        for profile in profiles:
            db.add(
                UploadColumnProfile(
                    upload_id=upload_id,
                    column_name=profile.column_name,
                    data_type=profile.data_type,
                    null_count=profile.null_count,
                    unique_count=profile.unique_count,
                    sample_values=profile.sample_values,
                )
            )

        db.commit()
        db.refresh(upload)

        # Save temp parquet for confirmation step
        try:
            df.to_parquet(_temp_path(upload_id), index=False)
            logger.debug("Saved temp parquet for upload %s", upload_id)
        except Exception as exc:
            logger.warning("Could not save temp parquet: %s", exc)

        return upload

    # ------------------------------------------------------------------
    # 7. Insert to PostgreSQL
    # ------------------------------------------------------------------
    def insert_to_database(
        self,
        db: Session,
        upload_id: uuid.UUID,
        column_mapping: dict[str, str],
        target_table: str,
    ) -> tuple[int, int]:
        """
        Load temp parquet, apply column mapping, and insert into PostgreSQL.

        Returns:
            (rows_inserted, processing_ms)
        """
        parquet_path = _temp_path(upload_id)
        if not os.path.exists(parquet_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Temporary upload data not found. Please re-upload the file.",
            )

        upload_record: DataUpload | None = (
            db.query(DataUpload).filter(DataUpload.id == upload_id).first()
        )

        start = perf_counter()
        try:
            df = pd.read_parquet(parquet_path)

            # Apply confirmed column mapping
            df.rename(columns=column_mapping, inplace=True)

            # Add metadata columns
            df["_upload_id"] = str(upload_id)
            df["_inserted_at"] = datetime.now(timezone.utc).isoformat()

            # Replace NaN with None for DB compatibility
            df = df.where(pd.notnull(df), other=None)

            # Convert datetime columns to strings to avoid tz issues
            for col in df.select_dtypes(include=["datetime", "datetimetz"]).columns:
                df[col] = df[col].astype(str)

            rows = len(df)
            chunksize = CHUNK_SIZE if rows > 10_000 else None

            df.to_sql(
                name=target_table,
                con=engine,
                if_exists="append",
                index=False,
                method="multi",
                chunksize=chunksize,
            )

            elapsed_ms = int((perf_counter() - start) * 1000)

            if upload_record:
                upload_record.status = "success"
                upload_record.row_count = rows
                upload_record.processing_ms = elapsed_ms
                upload_record.completed_at = datetime.now(timezone.utc)
                db.commit()

            logger.info(
                "Inserted %d rows into table '%s' in %dms", rows, target_table, elapsed_ms
            )

            # Audit success
            try:
                from app.services.audit_service import audit_service
                from app.models.user import User
                user_email = None
                user_role = None
                if upload_record and upload_record.uploaded_by:
                    user = db.query(User).filter(User.id == upload_record.uploaded_by).first()
                    if user:
                        user_email = user.email
                        user_role = user.role

                audit_service.write_log(
                    db,
                    action="UPLOAD_SUCCESS",
                    user_id=upload_record.uploaded_by if upload_record else None,
                    user_email=user_email,
                    user_role=user_role,
                    entity_type="upload",
                    entity_id=upload_id,
                    entity_name=upload_record.file_name if upload_record else "Unknown",
                    status="success",
                    duration_ms=elapsed_ms,
                    event_metadata={
                        "rows_inserted": rows,
                        "table_name": target_table,
                    },
                )
            except Exception as audit_err:
                logger.error(f"Upload success audit log failed: {audit_err}")

            # Cleanup temp file
            try:
                os.remove(parquet_path)
            except OSError:
                pass

            return rows, elapsed_ms

        except Exception as exc:
            elapsed_ms = int((perf_counter() - start) * 1000)
            logger.error("Insert failed for upload %s: %s", upload_id, exc)

            # Audit failure
            try:
                from app.services.audit_service import audit_service
                from app.models.user import User
                user_email = None
                user_role = None
                if upload_record and upload_record.uploaded_by:
                    user = db.query(User).filter(User.id == upload_record.uploaded_by).first()
                    if user:
                        user_email = user.email
                        user_role = user.role

                audit_service.write_log(
                    db,
                    action="UPLOAD_FAILED",
                    user_id=upload_record.uploaded_by if upload_record else None,
                    user_email=user_email,
                    user_role=user_role,
                    entity_type="upload",
                    entity_id=upload_id,
                    entity_name=upload_record.file_name if upload_record else "Unknown",
                    status="failure",
                    duration_ms=elapsed_ms,
                    error_message=str(exc)[:500],
                    event_metadata={"stage": "db_insert", "target_table": target_table},
                )
            except Exception as audit_err:
                logger.error(f"Upload failure audit log failed: {audit_err}")

            if upload_record:
                upload_record.status = "failed"
                upload_record.error_log = str(exc)
                upload_record.processing_ms = elapsed_ms
                db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database insertion failed: {exc}",
            ) from exc


# Singleton
ingestion_service = IngestionService()
