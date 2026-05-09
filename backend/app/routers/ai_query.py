"""
app/routers/ai_query.py

AI Query Assistant REST API.
Prefix: /api/v1/ai
Tags:   AI Query Assistant
"""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_role
from app.core.logger import get_logger
from app.database import get_db
from app.models.ai_session import AIQuerySession
from app.models.user import User
from app.schemas.ai_query import (
    AIAskRequest,
    AIAskResponse,
    AIExecuteRequest,
    AIGenerateRequest,
    AIGenerateResponse,
    AISessionHistoryItem,
    RateSessionRequest,
    SaveTemplateRequest,
    SchemaContextResponse,
    SuggestionChip,
)
from app.services.ai_service import ai_service

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/ai", tags=["AI Query Assistant"])


# ---------------------------------------------------------------------------
# 1. Generate SQL
# ---------------------------------------------------------------------------
@router.post("/generate", response_model=AIGenerateResponse)
def generate_sql(
    request: AIGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIGenerateResponse:
    """Convert natural language to SQL (generate only, no execution)."""
    return ai_service.generate_sql(db, request, current_user.id)


# ---------------------------------------------------------------------------
# 2. Execute AI session
# ---------------------------------------------------------------------------
@router.post("/execute", response_model=AIAskResponse)
def execute_ai_session(
    request: AIExecuteRequest,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> AIAskResponse:
    """Execute the SQL from an existing AI session (Manager/Admin only)."""
    try:
        session_id = uuid.UUID(request.session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id format.")
    return ai_service.execute_ai_session(db, session_id, current_user.id)


# ---------------------------------------------------------------------------
# 3. Ask (generate + optional execute)
# ---------------------------------------------------------------------------
@router.post("/ask", response_model=AIAskResponse)
def ask(
    request: AIAskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AIAskResponse:
    """Generate SQL from NL and optionally execute in one call."""
    # Analysts cannot auto-execute
    if request.auto_execute and current_user.role == "analyst":
        request = AIAskRequest(
            natural_language=request.natural_language,
            session_group_id=request.session_group_id,
            conversation_history=request.conversation_history,
            auto_execute=False,
        )
    return ai_service.ask(db, request, current_user.id)


# ---------------------------------------------------------------------------
# 4. History list
# ---------------------------------------------------------------------------
@router.get("/history", response_model=list[AISessionHistoryItem])
def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session_group_id: str | None = Query(None),
    rating: int | None = Query(None, ge=1, le=5),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AISessionHistoryItem]:
    q = db.query(AIQuerySession)

    if current_user.role == "analyst":
        q = q.filter(AIQuerySession.user_id == current_user.id)

    if session_group_id:
        try:
            grp = uuid.UUID(session_group_id)
            q = q.filter(AIQuerySession.session_group_id == grp)
        except ValueError:
            pass

    if rating is not None:
        q = q.filter(AIQuerySession.user_rating == rating)

    sessions = q.order_by(AIQuerySession.created_at.desc()).offset(skip).limit(limit).all()
    return [_to_history_item(s) for s in sessions]


# ---------------------------------------------------------------------------
# 5. History detail
# ---------------------------------------------------------------------------
@router.get("/history/{session_id}", response_model=AISessionHistoryItem)
def get_history_detail(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AISessionHistoryItem:
    s = db.query(AIQuerySession).filter(AIQuerySession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found.")
    if current_user.role == "analyst" and s.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return _to_history_item(s, include_snapshot=True)


# ---------------------------------------------------------------------------
# 6. Save as template
# ---------------------------------------------------------------------------
@router.post("/history/{session_id}/save-template")
def save_as_template(
    session_id: uuid.UUID,
    request: SaveTemplateRequest,
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
):
    """Save the AI-generated SQL as a reusable SQL template."""
    return ai_service.save_as_template(db, session_id, request, current_user.id)


# ---------------------------------------------------------------------------
# 7. Rate session
# ---------------------------------------------------------------------------
@router.post("/history/{session_id}/rate")
def rate_session(
    session_id: uuid.UUID,
    request: RateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return ai_service.rate_session(db, session_id, request, current_user.id)


# ---------------------------------------------------------------------------
# 8. Schema context
# ---------------------------------------------------------------------------
@router.get("/schema", response_model=SchemaContextResponse)
def get_schema(
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> SchemaContextResponse:
    return schema_service.get_schema_response(db)


# ---------------------------------------------------------------------------
# 9. Force schema refresh
# ---------------------------------------------------------------------------
@router.post("/schema/refresh", response_model=SchemaContextResponse)
def refresh_schema(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> SchemaContextResponse:
    return schema_service.force_refresh(db)


# ---------------------------------------------------------------------------
# 10. Suggestion chips
# ---------------------------------------------------------------------------
@router.get("/suggestions", response_model=list[SuggestionChip])
def get_suggestions(
    current_user: User = Depends(get_current_user),
) -> list[SuggestionChip]:
    return ai_service.get_suggestion_chips()


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _to_history_item(
    s: AIQuerySession, include_snapshot: bool = False
) -> AISessionHistoryItem:
    user_name = None
    try:
        if s.user:
            user_name = s.user.full_name
    except Exception:
        pass

    return AISessionHistoryItem(
        id=str(s.id),
        session_group_id=str(s.session_group_id) if s.session_group_id else None,
        turn_number=s.turn_number,
        natural_language=s.natural_language,
        generated_sql=s.generated_sql,
        explanation=s.explanation,
        confidence=s.confidence,
        tables_referenced=s.tables_referenced or [],
        warnings=s.warnings or [],
        execution_status=s.execution_status,
        row_count=s.row_count or 0,
        execution_ms=s.execution_ms,
        total_tokens=s.total_tokens or 0,
        user_rating=s.user_rating,
        saved_as_template=s.saved_as_template,
        was_executed=s.was_executed,
        result_snapshot=s.result_snapshot if include_snapshot else None,
        result_columns=s.result_columns if include_snapshot else None,
        error_message=s.error_message,
        executed_by_name=user_name,
        created_at=s.created_at,
    )
