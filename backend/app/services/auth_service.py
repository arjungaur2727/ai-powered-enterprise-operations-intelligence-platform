"""
app/services/auth_service.py

Business logic for user registration, authentication, and retrieval.
All DB interactions go through the SQLAlchemy session passed as a dependency.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.logger import get_logger
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse

logger = get_logger(__name__)


class AuthService:
    """Encapsulates all authentication-related business logic."""

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------
    def register_user(self, db: Session, user_create: UserCreate) -> UserResponse:
        """
        Create a new user account.

        Args:
            db: Active database session.
            user_create: Validated registration payload.

        Returns:
            UserResponse for the newly created user.

        Raises:
            HTTPException 400: If the email is already registered.
        """
        existing = db.query(User).filter(User.email == user_create.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists.",
            )

        user = User(
            email=user_create.email,
            full_name=user_create.full_name,
            hashed_password=hash_password(user_create.password),
            role=user_create.role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("New user registered: %s (role=%s)", user.email, user.role)
        return UserResponse.model_validate(user)

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------
    def authenticate_user(
        self, db: Session, email: str, password: str
    ) -> User | None:
        """
        Verify credentials and return the User if valid.

        Args:
            db: Active database session.
            email: Submitted email address.
            password: Plain-text password to verify.

        Returns:
            User ORM object on success, None otherwise.
        """
        user: User | None = db.query(User).filter(User.email == email).first()
        if not user or not verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        return user

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------
    def get_user_by_id(self, db: Session, user_id: uuid.UUID) -> User | None:
        """Return a User by primary key, or None if not found."""
        return db.query(User).filter(User.id == user_id).first()


# Singleton instance — import this instead of instantiating the class
auth_service = AuthService()
