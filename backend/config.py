"""
config.py - Pydantic Settings loading from .env
"""
import sys
from pydantic_settings import BaseSettings
from typing import Optional

_DEFAULT_SECRET = "change-me-in-production-use-a-long-random-string"


class Settings(BaseSettings):
    # Database — uses psycopg3 driver (postgresql+psycopg)
    DATABASE_URL: str = "postgresql+psycopg://postgres:password@localhost:5432/intern_mis"

    # JWT
    SECRET_KEY: str = _DEFAULT_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google OAuth2
    GOOGLE_CLIENT_ID: str = "GOOGLE_CLIENT_ID"
    GOOGLE_CLIENT_SECRET: str = "GOOGLE_CLIENT_SECRET"
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/auth/google/callback"

    # SMTP Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@mis.local"
    SMTP_USE_TLS: bool = True

    # App
    FRONTEND_URL: str = "https://inte-log-project.vercel.app"
    UPLOAD_DIR: str = "uploads"
    MAX_IMAGE_SIZE_MB: int = 5
    MAX_IMAGES_PER_LOG: int = 3

    # Rate limiting
    RATE_LIMIT_AUTH: str = "10/minute"

    # Cookie security — set True in production (requires HTTPS)
    COOKIE_SECURE: bool = True

    class Config:
        # Support running from project root OR from backend/ directory
        env_file = ["backend/.env", ".env", "/etc/secrets/.env"]
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()

# ── Startup guard: warn loudly if SECRET_KEY is still the default ────────────
if settings.SECRET_KEY == _DEFAULT_SECRET:
    import warnings
    warnings.warn(
        "\n\n  ⚠️  WARNING: SECRET_KEY is set to the default placeholder value.\n"
        "  JWTs can be forged by anyone who has read the source code.\n"
        "  Generate a real key with:\n"
        "    python -c \"import secrets; print(secrets.token_hex(32))\"\n"
        "  and add it to backend/.env as SECRET_KEY=<your-key>\n",
        stacklevel=2,
    )
