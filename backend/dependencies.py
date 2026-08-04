"""
dependencies.py - FastAPI dependency functions for auth and role enforcement
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session
from uuid import UUID

from backend.database import get_db
from backend.models import User
from backend.services.auth_service import decode_token

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Extract and validate JWT from Authorization header.
    Returns the authenticated User or raises 401.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")

        if user_id is None or token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if user.status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended",
        )
    if user.status == "shell":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not activated. Please complete registration.",
        )
    return user


def require_role(*roles: str):
    """
    Factory that returns a dependency enforcing role-based access.
    Interns with status=pending are blocked from logbook routes.
    """
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        # Pending/waiting interns cannot access protected routes
        if user.role == "intern" and user.status in ("pending", "waiting"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account pending approval",
            )
        return user

    return checker


# ── Role shorthand dependencies ───────────────────────────────────────────────

def get_current_active_intern(user: User = Depends(require_role("intern"))) -> User:
    """Shorthand dependency for active intern routes."""
    return user


def get_current_supervisor(user: User = Depends(require_role("supervisor"))) -> User:
    """Shorthand dependency for supervisor routes."""
    return user


def get_current_lecturer(user: User = Depends(require_role("lecturer"))) -> User:
    """
    Shorthand dependency for lecturer routes.
    Lecturers are pre-created by admin and are always active.
    """
    return user


def get_current_admin(user: User = Depends(require_role("admin"))) -> User:
    """Shorthand dependency for admin routes."""
    return user


def get_current_admin_or_lecturer(
    user: User = Depends(get_current_user),
) -> User:
    """Routes accessible by both admin and lecturer."""
    if user.role not in ("admin", "lecturer"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return user
