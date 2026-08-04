"""Run 003_features migration — execute each statement in its own transaction."""
import sys
sys.path.insert(0, '.')
from backend.database import engine
from sqlalchemy import text

STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(50) UNIQUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_status VARCHAR(20) DEFAULT 'unlinked'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path TEXT",
    "CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id)",

    """CREATE TABLE IF NOT EXISTS supervisor_geofences (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        latitude DECIMAL(10,8) NOT NULL,
        longitude DECIMAL(11,8) NOT NULL,
        radius_meters INTEGER NOT NULL DEFAULT 2000,
        is_active BOOLEAN DEFAULT TRUE,
        pinned_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(supervisor_id)
    )""",

    "CREATE INDEX IF NOT EXISTS idx_geofence_supervisor ON supervisor_geofences(supervisor_id)",

    """CREATE TABLE IF NOT EXISTS geofence_repin_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        old_latitude DECIMAL(10,8),
        old_longitude DECIMAL(11,8),
        new_latitude DECIMAL(10,8) NOT NULL,
        new_longitude DECIMAL(11,8) NOT NULL,
        reason TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
    )""",

    """CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        link_id UUID,
        link_type VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
    )""",

    "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)",

    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check",
    "ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending','active','suspended','waiting'))",

    "ALTER TABLE logbook_entries DROP CONSTRAINT IF EXISTS logbook_entries_status_check",
    "ALTER TABLE logbook_entries ADD CONSTRAINT logbook_entries_status_check CHECK (status IN ('draft','pending_approval','approved','rejected'))",
    "UPDATE logbook_entries SET status = 'pending_approval' WHERE status = 'otp_sent'",
]

ok = 0
skipped = 0
for stmt in STATEMENTS:
    with engine.begin() as conn:
        try:
            conn.execute(text(stmt))
            print(f"  OK  : {stmt.strip()[:70].replace(chr(10), ' ')}")
            ok += 1
        except Exception as e:
            print(f"  SKIP: {str(e)[:90]}")
            skipped += 1

print(f"\nDone — {ok} applied, {skipped} skipped (already exist).")
