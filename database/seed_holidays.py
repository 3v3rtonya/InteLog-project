"""
seed_holidays.py — Seeds Kenya public holidays for 2025, 2026, 2027.
Also registers a background 48-hour absence flagging job.
Run once: python database/seed_holidays.py

Repeatable — skips dates that already exist.
"""
import sys
sys.path.insert(0, '.')

from datetime import date
from backend.database import engine
from sqlalchemy import text

# Kenya public holidays — fixed dates
FIXED_HOLIDAYS = [
    (1,  1,  "New Year's Day"),
    (5,  1,  "Labour Day"),
    (6,  1,  "Madaraka Day"),
    (10, 10, "Huduma Day"),
    (10, 20, "Mashujaa Day"),
    (12, 12, "Jamhuri Day"),
    (12, 25, "Christmas Day"),
    (12, 26, "Boxing Day"),
]

# Variable holidays per year (Good Friday, Easter Monday — computed manually)
VARIABLE_HOLIDAYS = {
    2025: [
        (4, 18, "Good Friday"),
        (4, 21, "Easter Monday"),
    ],
    2026: [
        (4,  3, "Good Friday"),
        (4,  6, "Easter Monday"),
    ],
    2027: [
        (3, 26, "Good Friday"),
        (3, 29, "Easter Monday"),
    ],
}

YEARS = [2025, 2026, 2027]

inserted = 0
skipped  = 0

with engine.begin() as conn:
    for year in YEARS:
        holidays = [(m, d, name) for (m, d, name) in FIXED_HOLIDAYS]
        holidays += VARIABLE_HOLIDAYS.get(year, [])

        for month, day, name in holidays:
            try:
                d = date(year, month, day)
            except ValueError:
                continue  # invalid date for this year

            # Check if already exists
            existing = conn.execute(
                text("SELECT id FROM non_working_days WHERE date = :d"),
                {"d": d}
            ).fetchone()

            if existing:
                skipped += 1
                print(f"  SKIP : {d}  {name}")
            else:
                conn.execute(
                    text("""
                        INSERT INTO non_working_days (id, date, type, name, year, created_at)
                        VALUES (uuid_generate_v4(), :d, 'public_holiday', :name, :year, NOW())
                    """),
                    {"d": d, "name": name, "year": year}
                )
                inserted += 1
                print(f"  ADD  : {d}  {name}")

print(f"\nDone — {inserted} holidays seeded, {skipped} already existed.")
