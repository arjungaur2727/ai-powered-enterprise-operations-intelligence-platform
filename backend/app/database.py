"""
app/database.py

SQLAlchemy engine, session factory, declarative base, and FastAPI dependency.
Also provides a startup connectivity check.
"""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Engine & Session
# ---------------------------------------------------------------------------
engine = create_engine(
    settings.sqlalchemy_database_url,
    pool_pre_ping=True,       # reconnect on dropped connections
    pool_size=10,
    max_overflow=20,
    echo=(settings.ENVIRONMENT == "development"),
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Declarative base shared by all ORM models
Base = declarative_base()


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
def get_db():
    """Yield a database session and ensure it is closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Startup health check
# ---------------------------------------------------------------------------
def check_db_connection() -> None:
    """Test the database connection; log success or raise on failure."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection established successfully.")
    except OperationalError as exc:
        logger.error("Failed to connect to the database: %s", exc)
        raise
