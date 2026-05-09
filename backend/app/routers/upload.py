"""
app/routers/upload.py

Data ingestion REST endpoints.
Prefix: /api/v1/upload
Tags:   Data Ingestion
"""

import re
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.logger import get_logger
from app.database import get_db
from app.models.upload import DataUpload, UploadColumnProfile
from app.models.user import User
from app.schemas.upload import (
    ColumnProfileSchema,
    UploadConfirmRequest,
    UploadConfirmResponse,
    UploadDetailResponse,
    UploadHistoryItem,
    UploadInitResponse,
)
from app.services.audit_service import audit_service
from app.services.ingestion_service import ingestion_service

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/upload", tags=["Data Ingestion"])

_TABLE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")


def _validate_table_name(name: str) -> None:
    if not _TABLE_NAME_RE.match(name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid table name '{name}'. "
                "Must start with a letter, contain only lowercase letters, digits, "
                "or underscores, and be at most 63 characters."
            ),
        )


# ---------------------------------------------------------------------------
# POST /file — parse and preview
# ---------------------------------------------------------------------------
@router.post(
    "/file",
    response_model=UploadInitResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload and parse a CSV or Excel file",
)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    target_table: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadInitResponse:
    """
    Parse an uploaded file and return a preview with column profiles and
    validation errors. Data is **not** inserted into the DB at this point.
    Call POST /confirm/{upload_id} to commit.
    """
    _validate_table_name(target_table)

    df, file_type, file_size = await ingestion_service.parse_file(file)
    profiles = ingestion_service.profile_columns(df)
    validation_errors = ingestion_service.validate_dataframe(df)
    column_mapping = ingestion_service.generate_column_mapping(df)

    upload_id = uuid.uuid4()

    upload = ingestion_service.store_parsed_upload(
        db=db,
        df=df,
        file_name=file.filename or "unknown",
        file_type=file_type,
        file_size=file_size,
        profiles=profiles,
        validation_errors=validation_errors,
        column_mapping=column_mapping,
        user_id=current_user.id,
        target_table=target_table,
        upload_id=upload_id,
    )

    audit_service.log(
        db,
        action="FILE_UPLOAD_INIT",
        user_id=current_user.id,
        entity_type="upload",
        entity_id=upload.id,
        metadata={
            "file_name": upload.file_name,
            "file_type": file_type,
            "row_count": upload.row_count,
            "target_table": target_table,
        },
        ip_address=request.client.host if request.client else None,
    )

    return UploadInitResponse(
        upload_id=str(upload.id),
        file_name=upload.file_name,
        file_type=file_type,
        file_size=file_size,
        row_count=upload.row_count,
        column_count=upload.column_count,
        columns=profiles,
        preview_data=upload.preview_data or [],
        column_mapping=column_mapping,
        validation_errors=validation_errors,
        status=upload.status,
    )


# ---------------------------------------------------------------------------
# POST /confirm/{upload_id} — insert to DB
# ---------------------------------------------------------------------------
@router.post(
    "/confirm/{upload_id}",
    response_model=UploadConfirmResponse,
    summary="Confirm and insert parsed data into PostgreSQL",
)
def confirm_upload(
    upload_id: uuid.UUID,
    body: UploadConfirmRequest,
    request: Request,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> UploadConfirmResponse:
    """
    Trigger DB insertion for a previously parsed upload.
    Requires Manager or Admin role.
    """
    upload: DataUpload | None = (
        db.query(DataUpload).filter(DataUpload.id == upload_id).first()
    )
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload record not found.")

    if upload.status not in ("pending", "failed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Upload has already been processed (status='{upload.status}').",
        )

    _validate_table_name(body.target_table)

    # Update target table in case it was changed
    upload.target_table = body.target_table
    db.commit()

    rows_inserted, processing_ms = ingestion_service.insert_to_database(
        db=db,
        upload_id=upload_id,
        column_mapping=body.column_mapping,
        target_table=body.target_table,
    )

    audit_service.log(
        db,
        action="FILE_UPLOAD_CONFIRMED",
        user_id=current_user.id,
        entity_type="upload",
        entity_id=upload_id,
        metadata={
            "rows_inserted": rows_inserted,
            "target_table": body.target_table,
            "processing_ms": processing_ms,
        },
        ip_address=request.client.host if request.client else None,
    )

    return UploadConfirmResponse(
        upload_id=str(upload_id),
        status="success",
        rows_inserted=rows_inserted,
        target_table=body.target_table,
        processing_ms=processing_ms,
        message=f"Successfully inserted {rows_inserted:,} rows into '{body.target_table}'.",
    )


# ---------------------------------------------------------------------------
# GET /history
# ---------------------------------------------------------------------------
@router.get(
    "/history",
    response_model=list[UploadHistoryItem],
    summary="List upload history",
)
def get_upload_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    upload_status: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UploadHistoryItem]:
    """
    Return paginated upload history.
    Analysts see only their own uploads; Managers and Admins see all.
    """
    query = db.query(DataUpload)

    if current_user.role == "analyst":
        query = query.filter(DataUpload.uploaded_by == current_user.id)

    if upload_status:
        query = query.filter(DataUpload.status == upload_status)

    uploads = query.order_by(DataUpload.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for u in uploads:
        uploader_name: str | None = None
        if u.uploader:
            uploader_name = u.uploader.full_name
        result.append(
            UploadHistoryItem(
                id=u.id,
                file_name=u.file_name,
                file_type=u.file_type,
                row_count=u.row_count,
                column_count=u.column_count,
                target_table=u.target_table,
                status=u.status,
                uploaded_by_name=uploader_name,
                created_at=u.created_at,
                completed_at=u.completed_at,
            )
        )
    return result


# ---------------------------------------------------------------------------
# GET /{upload_id} — detail
# ---------------------------------------------------------------------------
@router.get(
    "/{upload_id}",
    response_model=UploadDetailResponse,
    summary="Get full detail for a single upload",
)
def get_upload_detail(
    upload_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadDetailResponse:
    upload: DataUpload | None = (
        db.query(DataUpload).filter(DataUpload.id == upload_id).first()
    )
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")

    # Analysts can only see their own
    if current_user.role == "analyst" and upload.uploaded_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    profiles = [
        ColumnProfileSchema(
            column_name=p.column_name or "",
            data_type=p.data_type or "string",
            null_count=p.null_count,
            unique_count=p.unique_count,
            sample_values=p.sample_values or [],
        )
        for p in upload.column_profiles
    ]

    return UploadDetailResponse(
        id=upload.id,
        file_name=upload.file_name,
        file_type=upload.file_type,
        original_size=upload.original_size,
        row_count=upload.row_count,
        column_count=upload.column_count,
        target_table=upload.target_table,
        status=upload.status,
        validation_errors=upload.validation_errors,
        column_mapping=upload.column_mapping,
        preview_data=upload.preview_data,
        error_log=upload.error_log,
        processing_ms=upload.processing_ms,
        created_at=upload.created_at,
        completed_at=upload.completed_at,
        columns=profiles,
    )


# ---------------------------------------------------------------------------
# DELETE /{upload_id} — admin only soft delete
# ---------------------------------------------------------------------------
@router.delete(
    "/{upload_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete an upload record (Admin only)",
)
def delete_upload(
    upload_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> None:
    upload: DataUpload | None = (
        db.query(DataUpload).filter(DataUpload.id == upload_id).first()
    )
    if not upload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found.")

    upload.status = "deleted"
    db.commit()

    audit_service.log(
        db,
        action="UPLOAD_DELETED",
        user_id=current_user.id,
        entity_type="upload",
        entity_id=upload_id,
        ip_address=request.client.host if request.client else None,
    )
