"""
main.py — FastAPI application entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.logger import get_logger
from app.database import check_db_connection

# Models — imported so Alembic can detect via Base.metadata
from app.models import alert  # noqa: F401
from app.models import audit  # noqa: F401

# Routers
from app.routers import auth
from app.routers import upload as upload_router_module
from app.routers import sql as sql_router_module
from app.routers import ai_query as ai_router_module
from app.routers import dashboard as dashboard_router_module
from app.routers import reports as reports_router_module
from app.routers import alerts as alerts_router_module
from app.routers import audit as audit_router_module

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Enterprise Ops Intelligence API — env=%s", settings.ENVIRONMENT)
    check_db_connection()

    # Seed default report templates and alert rules
    try:
        from app.database import SessionLocal
        from app.core.seed_data import seed_report_templates, seed_alert_rules
        _db = SessionLocal()
        seed_report_templates(_db)
        seed_alert_rules(_db)
        _db.close()
    except Exception as exc:
        logger.warning("Seed data error: %s", exc)

    # Ensure report storage directory exists
    from pathlib import Path
    Path("generated_reports").mkdir(exist_ok=True)

    # Pass scheduler instance to app state for monitoring
    try:
        from app.scheduler.scheduler import get_scheduler, start_scheduler
        app.state.scheduler = get_scheduler()
        start_scheduler()
    except Exception as exc:
        logger.warning("APScheduler could not start: %s", exc)

    # SYSTEM_STARTUP Audit Log
    try:
        from app.database import SessionLocal
        from app.services.audit_service import audit_service
        _db = SessionLocal()
        audit_service.write_log(
            db=_db,
            action="SYSTEM_STARTUP",
            status="success",
            event_metadata={
                "environment": settings.ENVIRONMENT,
                "version": "1.0.0",
                "modules": [
                    "auth", "ingestion", "sql_engine", "ai_assistant",
                    "dashboard", "reporting", "alerts", "audit"
                ]
            }
        )
        _db.close()
    except Exception as exc:
        logger.warning("Startup audit log failed: %s", exc)

    logger.info("Application startup complete.")
    yield

    try:
        from app.scheduler.scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception as exc:
        logger.warning("APScheduler shutdown error: %s", exc)

    logger.info("Application shutdown complete.")


app = FastAPI(
    title="Enterprise Ops Intelligence API",
    version="1.0.0",
    description="AI-Powered Enterprise Operations Intelligence Platform — REST API built with FastAPI.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload_router_module.router)
app.include_router(sql_router_module.router)
app.include_router(ai_router_module.router)
app.include_router(dashboard_router_module.router)
app.include_router(reports_router_module.router)
app.include_router(alerts_router_module.router)
app.include_router(audit_router_module.router)


@app.get("/health", tags=["Health"], summary="Service health probe")
def health_check() -> dict:
    return {"status": "ok", "environment": settings.ENVIRONMENT}
