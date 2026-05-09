"""
app/schemas/auth.py

Pydantic request / response schemas for authentication endpoints.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------
class UserCreate(BaseModel):
    """Payload for registering a new user."""

    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8, description="Plain-text password (hashed server-side)")
    role: str = Field(..., pattern="^(admin|manager|analyst)$")


class LoginRequest(BaseModel):
    """Payload for the /login endpoint."""

    email: EmailStr
    password: str


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------
class UserResponse(BaseModel):
    """Safe user representation — never exposes hashed_password."""

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """JWT auth response returned after successful login."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
