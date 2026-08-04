"""
pii_service.py - PII scrubbing using regex patterns.
SpaCy NER has been removed; regex rules cover IDs and phone numbers.
"""
import re
import logging

logger = logging.getLogger(__name__)


def scrub_pii(text: str) -> str:
    """
    Remove personally identifiable information from text using regex.

    Scrubs:
    - Staff/intern ID patterns (INT-001, EMP12345, STF-001, ID-001) → [ID-REDACTED]
    - Phone number patterns (10-13 digit sequences) → [PHONE-REDACTED]
    - Email addresses → [EMAIL-REDACTED]

    Args:
        text: The original text to scrub

    Returns:
        Scrubbed text with PII replaced
    """
    if not text:
        return text

    scrubbed = text

    # Scrub email addresses first (before phone pattern can match digits)
    scrubbed = re.sub(
        r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b',
        '[EMAIL-REDACTED]',
        scrubbed,
    )

    # Scrub staff/intern ID patterns
    scrubbed = re.sub(
        r'\b(INT|EMP|STF|ID)[-]?\d{3,8}\b',
        '[ID-REDACTED]',
        scrubbed,
        flags=re.IGNORECASE,
    )

    # Scrub phone number patterns (10-13 consecutive digits, optional leading +)
    scrubbed = re.sub(r'\+?\b\d{10,13}\b', '[PHONE-REDACTED]', scrubbed)

    return scrubbed
