"""
auth_service.py - Password hashing, JWT creation/verification, Google OAuth.

Uses bcrypt directly (not via passlib) for Python 3.14 compatibility.
"""
import bcrypt
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt

from backend.config import settings

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt (cost factor 12)."""
    pwd_bytes = password.encode("utf-8")
    # bcrypt has a 72-byte limit; truncate to be safe
    if len(pwd_bytes) > 72:
        pwd_bytes = pwd_bytes[:72]
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    try:
        pwd_bytes = plain_password.encode("utf-8")
        if len(pwd_bytes) > 72:
            pwd_bytes = pwd_bytes[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with 15-minute default expiry."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token with 7-day expiry."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


async def exchange_google_code(code: str) -> dict:
    """
    Exchange a Google OAuth2 authorization code for user info.
    Returns a dict with: sub, email, name, picture
    """
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_response.raise_for_status()
        tokens = token_response.json()

        userinfo_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        userinfo_response.raise_for_status()
        return userinfo_response.json()
