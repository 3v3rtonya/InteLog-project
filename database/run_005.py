"""Run 005_attendance.sql migration."""
import sys
sys.path.insert(0, '.')
from backend.database import engine
from sqlalchemy import text

STATEMENTS = [
    # 1. Attachment period on users
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS attachment_start   DATE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS attachment_end     DATE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_change_count  INTEGER NOT NULL DEFAULT 0",

    # 2. Absence requests
    """CREATE TABLE IF NOT EXISTS absence_requests (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        intern_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date             DATE NOT NULL,
        type             VARCHAR(20) NOT NULL
                         CHECK (type IN ('sick','day_off','emergency','half_day')),
        reason           TEXT NOT NULL,
        status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','acknowledged','rejected')),
        acknowledged_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        acknowledged_at  TIMESTAMP WITH TIME ZONE,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (intern_id, date)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_absence_intern ON absence_requests(intern_id)",
    "CREATE INDEX IF NOT EXISTS idx_absence_date   ON absence_requests(date)",

    # 3. Non-working days
    """CREATE TABLE IF NOT EXISTS non_working_days (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        date        DATE NOT NULL UNIQUE,
        type        VARCHAR(20) NOT NULL DEFAULT 'public_holiday'
                    CHECK (type IN ('public_holiday','custom')),
        name        VARCHAR(255) NOT NULL,
        year        INTEGER NOT NULL,
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_nwd_year ON non_working_days(year)",
    "CREATE INDEX IF NOT EXISTS idx_nwd_date ON non_working_days(date)",

    # 4. submitted_on_non_working_day on logbook_entries
    "ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS submitted_on_non_working_day BOOLEAN DEFAULT FALSE",
]

ok = skipped = 0
for stmt in STATEMENTS:
    with engine.begin() as conn:
        try:
            conn.execute(text(stmt))
            print(f"  OK  : {stmt.strip()[:80].replace(chr(10),' ')}")
            ok += 1
        except Exception as e:
            print(f"  SKIP: {stmt.strip()[:60].replace(chr(10),' ')} => {str(e)[:50]}")
            skipped += 1

print(f"\nDone — {ok} applied, {skipped} skipped.")
