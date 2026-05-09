"""
app/routers/dashboard.py — KPI Dashboard & Analytics endpoints.
Prefix: /api/v1/dashboard
"""
from __future__ import annotations
from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user, require_role
from app.database import get_db
from app.models.user import User
from app.schemas.dashboard import (
    AIConfidenceResponse, ActivityFeedItem, KPISummaryResponse,
    PerformanceAlert, PerformanceTrendResponse, QueryTrendResponse,
    TokenUsageDataPoint, TopTemplateItem, TopUserItem, UploadTrendResponse,
    WorkflowStatusResponse,
)
from app.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard & Analytics"])


@router.get("/summary", response_model=KPISummaryResponse)
def get_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = dashboard_service.get_kpi_summary(db)
    return JSONResponse(content=data.model_dump(), headers={"Cache-Control": "max-age=60"})


@router.get("/trends/queries", response_model=QueryTrendResponse)
def get_query_trend(days: int = Query(14, ge=7, le=90), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return dashboard_service.get_query_trend(db, days)


@router.get("/trends/uploads", response_model=UploadTrendResponse)
def get_upload_trend(days: int = Query(7, ge=3, le=30), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return dashboard_service.get_upload_trend(db, days)


@router.get("/trends/performance", response_model=PerformanceTrendResponse)
def get_performance_trend(days: int = Query(14, ge=7, le=90), current_user: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    return dashboard_service.get_performance_trend(db, days)


@router.get("/workflows/status", response_model=WorkflowStatusResponse)
def get_workflow_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return dashboard_service.get_workflow_status(db)


@router.get("/ai/confidence", response_model=AIConfidenceResponse)
def get_ai_confidence(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return dashboard_service.get_ai_confidence_distribution(db)


@router.get("/ai/token-usage", response_model=list[TokenUsageDataPoint])
def get_token_usage(days: int = Query(14, ge=7, le=30), current_user: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    return dashboard_service.get_token_usage_trend(db, days)


@router.get("/activity/feed", response_model=list[ActivityFeedItem])
def get_activity_feed(limit: int = Query(20, ge=5, le=50), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return dashboard_service.get_activity_feed(db, limit)


@router.get("/alerts/performance", response_model=list[PerformanceAlert])
def get_performance_alerts(current_user: User = Depends(require_role("manager", "admin")), db: Session = Depends(get_db)):
    return dashboard_service.get_performance_alerts(db)


@router.get("/top/templates", response_model=list[TopTemplateItem])
def get_top_templates(limit: int = Query(5, ge=3, le=10), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return dashboard_service.get_top_templates(db, limit)


@router.get("/top/users", response_model=list[TopUserItem])
def get_top_users(limit: int = Query(5, ge=3, le=10), current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return dashboard_service.get_top_users(db, limit)


@router.post("/kpi/snapshot")
def trigger_snapshot(current_user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    dashboard_service.trigger_daily_kpi_snapshot(db)
    return {"message": "KPI snapshot saved", "date": date.today().isoformat()}
