"""
app/services/ai_service.py

Core AI service — GPT-4o prompt engineering, OpenAI API calls,
SQL extraction, confidence scoring, and session persistence.
"""

from __future__ import annotations

import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

import openai
from fastapi import HTTPException, status
from openai import OpenAI
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logger import get_logger
from app.models.ai_session import AIQuerySession
from app.schemas.ai_query import (
    AIAskRequest,
    AIAskResponse,
    AIGenerateRequest,
    AIGenerateResponse,
    RateSessionRequest,
    SaveTemplateRequest,
    SuggestionChip,
)
from app.services.schema_service import schema_service
logger = get_logger(__name__)

MODEL_NAME = "gpt-4o"
MAX_RETRIES = 2

SYSTEM_PROMPT_TEMPLATE = """You are an expert PostgreSQL data analyst assistant for an enterprise operations platform.
Your ONLY job is to convert natural language questions into accurate, optimized PostgreSQL SELECT queries.

DATABASE SCHEMA:
{schema_text}

STRICT RULES — NEVER VIOLATE:
1. Output ONLY a JSON object. No markdown, no explanation outside JSON.
2. JSON format:
   {{"sql": "SELECT ... FROM ...", "explanation": "Plain English: what this query does.", "confidence": "high|medium|low", "tables_referenced": ["table1"], "warnings": []}}
3. Only write SELECT statements. NEVER use INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE.
4. Always use table aliases for readability.
5. Always add LIMIT 1000 unless user specifies otherwise.
6. When filtering by time: use NOW() and INTERVAL.
7. For "this week": use DATE_TRUNC('week', NOW()).
8. If question is ambiguous, note assumption in warnings.
9. If question cannot be answered with available schema, set sql to null and explain why.
10. Only reference tables and columns that EXIST in the schema. Never hallucinate column names.
11. Use proper JOINs when data spans multiple tables.

FEW-SHOT EXAMPLES:
User: "Show me all failed queries this week"
Output: {{"sql": "SELECT qh.id, qh.query_text, qh.error_message, qh.executed_at, u.full_name as executed_by FROM query_history qh LEFT JOIN users u ON qh.executed_by = u.id WHERE qh.status = 'failed' AND qh.executed_at >= DATE_TRUNC('week', NOW()) ORDER BY qh.executed_at DESC LIMIT 1000", "explanation": "Retrieves all failed query executions from the current week, including who ran them.", "confidence": "high", "tables_referenced": ["query_history", "users"], "warnings": []}}

User: "How many files were uploaded today?"
Output: {{"sql": "SELECT COUNT(*) as upload_count, SUM(row_count) as total_rows FROM data_uploads WHERE DATE(created_at) = CURRENT_DATE AND status = 'success'", "explanation": "Counts successful file uploads made today and total rows imported.", "confidence": "high", "tables_referenced": ["data_uploads"], "warnings": []}}

User: "Show low performing uploads this week"
Output: {{"sql": "SELECT du.target_table, du.file_name, du.row_count, du.status, du.created_at, u.full_name as uploaded_by FROM data_uploads du LEFT JOIN users u ON du.uploaded_by = u.id WHERE du.created_at >= DATE_TRUNC('week', NOW()) AND du.row_count < 100 ORDER BY du.row_count ASC LIMIT 1000", "explanation": "Shows uploads from this week with fewer than 100 rows.", "confidence": "medium", "tables_referenced": ["data_uploads", "users"], "warnings": ["Assumed low-performing means fewer than 100 rows"]}}
"""


class AIService:
    """GPT-4o powered natural language to SQL generation service."""

    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    # ------------------------------------------------------------------
    # 1. Build messages array
    # ------------------------------------------------------------------
    def build_messages(
        self,
        natural_language: str,
        schema_text: str,
        conversation_history: list[dict],
    ) -> list[dict]:
        system_content = SYSTEM_PROMPT_TEMPLATE.format(schema_text=schema_text)
        messages: list[dict] = [{"role": "system", "content": system_content}]
        # Keep last 6 turns (3 pairs) for context efficiency
        trimmed_history = conversation_history[-6:] if conversation_history else []
        messages.extend(trimmed_history)
        messages.append({"role": "user", "content": natural_language})
        return messages

    # ------------------------------------------------------------------
    # 2. Call OpenAI with retry
    # ------------------------------------------------------------------
    def call_openai(
        self, messages: list[dict]
    ) -> tuple[str, int, int, int, int]:
        """Returns (raw_content, prompt_tokens, completion_tokens, total_tokens, ms)."""
        for attempt in range(MAX_RETRIES + 1):
            try:
                start = time.perf_counter()
                response = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    temperature=0,
                    max_tokens=1500,
                    response_format={"type": "json_object"},
                )
                elapsed_ms = int((time.perf_counter() - start) * 1000)
                content = response.choices[0].message.content or ""
                usage = response.usage
                return (
                    content,
                    usage.prompt_tokens,
                    usage.completion_tokens,
                    usage.total_tokens,
                    elapsed_ms,
                )
            except openai.RateLimitError:
                if attempt < MAX_RETRIES:
                    time.sleep(2 ** attempt)
                    continue
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="AI service rate limit reached. Please try again in a moment.",
                )
            except openai.APIConnectionError:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Unable to connect to AI service. Check API key configuration.",
                )
            except openai.AuthenticationError:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid OpenAI API key. Contact your administrator.",
                )
            except Exception as exc:
                logger.error("OpenAI API error: %s", exc)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="AI query generation failed. Please try again.",
                )
        raise HTTPException(status_code=500, detail="AI generation failed after retries.")

    # ------------------------------------------------------------------
    # 3. Parse AI JSON response
    # ------------------------------------------------------------------
    def parse_ai_response(self, raw_content: str) -> dict:
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw_content, re.DOTALL)
            if match:
                try:
                    data = json.loads(match.group())
                except Exception:
                    raise HTTPException(
                        status_code=500,
                        detail="AI returned unparseable response.",
                    )
            else:
                raise HTTPException(
                    status_code=500, detail="AI returned unparseable response."
                )

        return {
            "sql": data.get("sql"),
            "explanation": data.get("explanation", "No explanation provided."),
            "confidence": data.get("confidence", "low"),
            "tables_referenced": data.get("tables_referenced", []),
            "warnings": data.get("warnings", []),
        }

    # ------------------------------------------------------------------
    # 4. Check daily token budget
    # ------------------------------------------------------------------
    def check_token_budget(self, db: Session) -> None:
        max_tokens = getattr(settings, "OPENAI_MAX_TOKENS_PER_DAY", 100_000)
        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        total_today = (
            db.query(func.coalesce(func.sum(AIQuerySession.total_tokens), 0))
            .filter(AIQuerySession.created_at >= today_start)
            .scalar()
        ) or 0

        if total_today >= max_tokens:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Daily AI token limit ({max_tokens:,}) reached. Try again tomorrow.",
            )

    # ------------------------------------------------------------------
    # 5. Generate SQL (full pipeline)
    # ------------------------------------------------------------------
    def generate_sql(
        self,
        db: Session,
        request: AIGenerateRequest,
        current_user_id: uuid.UUID,
    ) -> AIGenerateResponse:
        self.check_token_budget(db)

        schema_dict, schema_text = schema_service.get_schema_context(db)
        messages = self.build_messages(
            request.natural_language, schema_text, request.conversation_history
        )
        raw, p_tok, c_tok, total_tok, gen_ms = self.call_openai(messages)
        parsed = self.parse_ai_response(raw)

        logger.info(
            "AI tokens used: prompt=%d completion=%d total=%d conf=%s",
            p_tok, c_tok, total_tok, parsed["confidence"],
        )

        # Determine session group
        if request.session_group_id:
            try:
                grp_id = uuid.UUID(request.session_group_id)
            except ValueError:
                grp_id = uuid.uuid4()
        else:
            grp_id = uuid.uuid4()

        # Turn number
        turn_number = (
            db.query(AIQuerySession)
            .filter(AIQuerySession.session_group_id == grp_id)
            .count()
        ) + 1

        session = AIQuerySession(
            user_id=current_user_id,
            session_group_id=grp_id,
            turn_number=turn_number,
            natural_language=request.natural_language,
            schema_context_used=schema_text[:2000],
            generated_sql=parsed["sql"],
            explanation=parsed["explanation"],
            model_used=MODEL_NAME,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=total_tok,
            generation_ms=gen_ms,
            confidence=parsed["confidence"],
            tables_referenced=parsed["tables_referenced"],
            warnings=parsed["warnings"],
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        # Audit log
        try:
            from app.services.audit_service import audit_service
            user_email = None
            user_role = None
            from app.models.user import User
            user = db.query(User).filter(User.id == current_user_id).first()
            if user:
                user_email = user.email
                user_role = user.role

            audit_service.write_log(
                db,
                action="AI_QUERY_EXECUTED", # Blueprint says AI_QUERY_EXECUTED for generation success
                user_id=current_user_id,
                user_email=user_email,
                user_role=user_role,
                entity_type="ai_query",
                entity_id=session.id,
                status="success",
                duration_ms=gen_ms,
                event_metadata={
                    "natural_language": request.natural_language[:200],
                    "tokens_used": total_tok,
                    "model": MODEL_NAME,
                    "sql_generated": parsed["sql"][:300] if parsed["sql"] else None,
                },
            )
        except Exception as e:
            logger.error(f"AI audit log failed: {e}")

        return AIGenerateResponse(
            session_id=str(session.id),
            session_group_id=str(grp_id),
            generated_sql=parsed["sql"],
            explanation=parsed["explanation"],
            confidence=parsed["confidence"],
            tables_referenced=parsed["tables_referenced"],
            warnings=parsed["warnings"],
            model_used=MODEL_NAME,
            total_tokens=total_tok,
            generation_ms=gen_ms,
        )

    # ------------------------------------------------------------------
    # 6. Execute AI session SQL
    # ------------------------------------------------------------------
    def execute_ai_session(
        self,
        db: Session,
        session_id: uuid.UUID,
        current_user_id: uuid.UUID,
    ) -> AIAskResponse:
        session = db.query(AIQuerySession).filter(AIQuerySession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="AI session not found.")
        if session.generated_sql is None:
            raise HTTPException(status_code=400, detail="No SQL was generated for this session.")
        if session.was_executed:
            raise HTTPException(status_code=400, detail="This query has already been executed.")

        from app.services.sql_service import sql_service

        exec_result = sql_service.execute_query(
            db=db,
            query_text=session.generated_sql,
            params={},
            executed_by_id=current_user_id,
            source="ai_generated",
            template_id=None,
            workflow_id=None,
        )

        session.was_executed = True
        session.execution_status = exec_result.status
        session.row_count = exec_result.row_count
        session.execution_ms = exec_result.execution_ms
        session.result_snapshot = exec_result.rows[:100] if exec_result.rows else []
        session.result_columns = [c.model_dump() for c in exec_result.columns]
        session.error_message = exec_result.error_message
        db.commit()

        try:
            from app.services.audit_service import audit_service
            user_email = None
            user_role = None
            from app.models.user import User
            user = db.query(User).filter(User.id == current_user_id).first()
            if user:
                user_email = user.email
                user_role = user.role

            audit_service.write_log(
                db,
                action="AI_QUERY_EXECUTED" if exec_result.status == "success" else "AI_QUERY_FAILED",
                user_id=current_user_id,
                user_email=user_email,
                user_role=user_role,
                entity_type="ai_query",
                entity_id=session.id,
                status=exec_result.status,
                duration_ms=exec_result.execution_ms,
                event_metadata={
                    "rows": exec_result.row_count,
                    "session_id": str(session.id),
                    "sql": session.generated_sql[:300]
                },
                error_message=exec_result.error_message
            )
        except Exception as e:
            logger.error(f"AI exec audit log failed: {e}")

        return AIAskResponse(
            session_id=str(session.id),
            session_group_id=str(session.session_group_id),
            natural_language=session.natural_language,
            generated_sql=session.generated_sql,
            explanation=session.explanation or "",
            confidence=session.confidence or "low",
            tables_referenced=session.tables_referenced or [],
            warnings=session.warnings or [],
            was_executed=True,
            execution_status=exec_result.status,
            row_count=exec_result.row_count,
            columns=[c.model_dump() for c in exec_result.columns],
            rows=exec_result.rows,
            execution_ms=exec_result.execution_ms,
            error_message=exec_result.error_message,
            total_tokens=session.total_tokens,
            generation_ms=session.generation_ms or 0,
        )

    # ------------------------------------------------------------------
    # 7. Ask (generate + optionally execute)
    # ------------------------------------------------------------------
    def ask(
        self,
        db: Session,
        request: AIAskRequest,
        current_user_id: uuid.UUID,
    ) -> AIAskResponse:
        gen_request = AIGenerateRequest(
            natural_language=request.natural_language,
            session_group_id=request.session_group_id,
            conversation_history=request.conversation_history,
        )
        gen_response = self.generate_sql(db, gen_request, current_user_id)

        if request.auto_execute and gen_response.generated_sql:
            return self.execute_ai_session(
                db, uuid.UUID(gen_response.session_id), current_user_id
            )

        return AIAskResponse(
            session_id=gen_response.session_id,
            session_group_id=gen_response.session_group_id,
            natural_language=request.natural_language,
            generated_sql=gen_response.generated_sql,
            explanation=gen_response.explanation,
            confidence=gen_response.confidence,
            tables_referenced=gen_response.tables_referenced,
            warnings=gen_response.warnings,
            was_executed=False,
            execution_status=None,
            row_count=0,
            columns=None,
            rows=None,
            execution_ms=None,
            total_tokens=gen_response.total_tokens,
            generation_ms=gen_response.generation_ms,
        )

    # ------------------------------------------------------------------
    # 8. Save as SQL template
    # ------------------------------------------------------------------
    def save_as_template(
        self,
        db: Session,
        session_id: uuid.UUID,
        request: SaveTemplateRequest,
        current_user_id: uuid.UUID,
    ):
        session = db.query(AIQuerySession).filter(AIQuerySession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")
        if session.generated_sql is None:
            raise HTTPException(status_code=400, detail="No SQL to save.")
        if session.saved_as_template:
            raise HTTPException(status_code=400, detail="Already saved as template.")

        from app.services.sql_service import sql_service
        from app.schemas.sql_template import SQLTemplateCreate

        tags = list(set((request.tags or []) + ["ai_generated"]))
        tmpl = sql_service.create_template(
            db,
            SQLTemplateCreate(
                name=request.name,
                description=request.description or session.natural_language,
                query_text=session.generated_sql,
                tags=tags,
                is_public=False,
            ),
            current_user_id,
        )

        session.saved_as_template = True
        try:
            from uuid import UUID
            session.template_id = UUID(tmpl.id)
        except Exception:
            pass
        db.commit()
        return tmpl

    # ------------------------------------------------------------------
    # 9. Rate session
    # ------------------------------------------------------------------
    def rate_session(
        self,
        db: Session,
        session_id: uuid.UUID,
        request: RateSessionRequest,
        current_user_id: uuid.UUID,
    ) -> dict:
        session = db.query(AIQuerySession).filter(AIQuerySession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")
        session.user_rating = request.rating
        session.user_feedback = request.feedback
        db.commit()
        return {"message": "Rating saved", "rating": request.rating}

    # ------------------------------------------------------------------
    # 10. Suggestion chips
    # ------------------------------------------------------------------
    def get_suggestion_chips(self) -> list[SuggestionChip]:
        return [
            SuggestionChip(label="Failed queries this week", query="Show me all failed SQL queries from this week", category="Operations"),
            SuggestionChip(label="Top uploaders", query="Who uploaded the most files this month?", category="Analytics"),
            SuggestionChip(label="AI usage summary", query="How many AI queries were run today and how many tokens were used?", category="Analytics"),
            SuggestionChip(label="Pending workflows", query="Show all scheduled workflows that haven't run successfully yet", category="Operations"),
            SuggestionChip(label="Low row uploads", query="Show uploads from this week with fewer than 50 rows", category="Reporting"),
            SuggestionChip(label="Active users today", query="Which users have been most active today?", category="Analytics"),
            SuggestionChip(label="Slow queries", query="Show the 10 slowest queries in the past 7 days", category="Performance"),
            SuggestionChip(label="Template usage", query="Which SQL templates have been used the most this month?", category="Reporting"),
        ]


ai_service = AIService()
