"""
app/config.py

Application settings loaded from environment variables via pydantic-settings.
A single `settings` instance is exported for use across the application.
"""

from pydantic_settings import BaseSettings
from pydantic import EmailStr


class Settings(BaseSettings):
    """All configurable application settings, sourced from .env or environment."""

    # Database
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_MAX_TOKENS_PER_DAY: int = 100_000

    # SMTP / Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    # Runtime
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "*"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
