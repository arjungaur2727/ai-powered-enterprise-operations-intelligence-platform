"""
app/routers/auth.py

Authentication routes: register, login, and current-user retrieval.
Prefix: /api/v1/auth
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.logger import get_logger
from app.core.security import create_access_token
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserCreate, UserResponse
from app.services.audit_service import audit_service
from app.services.auth_service import auth_service

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(
    user_create: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Create a new platform user and write an audit event."""
    new_user = auth_service.register_user(db, user_create)
    audit_service.write_log(
        db,
        action="USER_CREATED",
        user_id=new_user.id,
        user_email=new_user.email,
        user_role=new_user.role,
        entity_type="user",
        entity_id=new_user.id,
        entity_name=new_user.email,
        event_metadata={"email": new_user.email, "role": new_user.role},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive a JWT",
)
def login(
    login_request: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Validate credentials and return a signed JWT access token."""
    user: User | None = auth_service.authenticate_user(
        db, login_request.email, login_request.password
    )
    if not user:
        audit_service.write_log(
            db,
            action="AUTH_FAILED",
            user_email=login_request.email,
            status="failure",
            event_metadata={"reason": "invalid_credentials"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": str(user.id), "role": user.role})

    audit_service.write_log(
        db,
        action="AUTH_LOGIN",
        user_id=user.id,
        user_email=user.email,
        user_role=user.role,
        entity_type="user",
        entity_id=user.id,
        entity_name=user.email,
        event_metadata={"login_method": "jwt"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )

    return TokenResponse(
        access_token=token,
        user=UserResponse.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Return the currently authenticated user",
)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Decode the Bearer token and return the caller's user profile."""
    return UserResponse.model_validate(current_user)


@router.post("/logout", summary="Logout and record audit event")
def logout(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Logout the current user."""
    audit_service.write_log(
        db,
        action="AUTH_LOGOUT",
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        status="success",
    )
    return {"detail": "Successfully logged out"}
