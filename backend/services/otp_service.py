"""
otp_service.py - OTP generation, hashing, and verification
"""
import secrets
import hashlib
from datetime import datetime, timezone


def generate_otp() -> str:
    """
    Generate a cryptographically secure 6-digit OTP.
    Returns a string like "123456".
    """
    return str(secrets.randbelow(900_000) + 100_000)


def hash_otp(otp: str) -> str:
    """
    Hash an OTP using SHA-256.
    Returns the hex digest string.
    """
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp(plain_otp: str, stored_hash: str, expires_at: datetime) -> bool:
    """
    Verify a plain OTP against its stored hash and check expiry.

    Args:
        plain_otp: The OTP entered by the user
        stored_hash: The SHA-256 hash stored in the database
        expires_at: The expiry datetime of the OTP

    Returns:
        True if OTP is valid and not expired, False otherwise
    """
    if datetime.now(timezone.utc) > expires_at:
        return False
    computed_hash = hashlib.sha256(plain_otp.encode()).hexdigest()
    return computed_hash == stored_hash
