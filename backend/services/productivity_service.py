"""
productivity_service.py - Log quality analysis and productivity flagging
"""
from typing import Tuple, List

# Filler phrases that indicate low-effort entries
FILLER_PHRASES = [
    "nothing",
    "n/a",
    "same as yesterday",
    "no activity",
    "nil",
]

# Maximum word count per combined log entry (activities + solutions)
# 500 words gives interns reasonable room for a detailed daily log
# while still flagging padded/copy-pasted submissions.
MAX_WORD_COUNT = 500

# Minimum vocabulary diversity ratio (unique words / total words)
MIN_DIVERSITY_RATIO = 0.4


def analyze_log_quality(activities: str, solutions: str) -> Tuple[bool, str]:
    """
    Analyze the quality of a logbook entry and flag low-effort submissions.

    Checks:
    1. Total word count > 250 → flagged (entry exceeds maximum allowed)
    2. Vocabulary diversity ratio < 0.4 → flagged
    3. Contains filler phrases → flagged

    Args:
        activities: The activities_performed text
        solutions: The solutions_offered text

    Returns:
        Tuple of (is_flagged: bool, flag_reason: str)
    """
    flags: List[str] = []
    combined = (activities + " " + solutions).strip()
    words = combined.split()
    word_count = len(words)

    # Check 1: Word count cap
    if word_count > MAX_WORD_COUNT:
        flags.append(f"Log exceeds maximum length ({word_count} words; limit is {MAX_WORD_COUNT})")

    # Check 2: Vocabulary diversity
    if word_count > 0:
        unique_ratio = len(set(combined.lower().split())) / word_count
        if unique_ratio < MIN_DIVERSITY_RATIO:
            flags.append("High word repetition detected")

    # Check 3: Filler phrases
    combined_lower = combined.lower()
    for phrase in FILLER_PHRASES:
        if phrase in combined_lower:
            flags.append(f"Filler phrase detected: '{phrase}'")
            break  # Only report first filler phrase found

    is_flagged = bool(flags)
    flag_reason = "; ".join(flags) if flags else ""

    return is_flagged, flag_reason
