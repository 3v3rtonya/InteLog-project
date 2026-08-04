"""Run 004_roles.sql migration — each statement in its own transaction."""
import sys
sys.path.insert(0, '.')
from backend.database import engine
from sqlalchemy import text

STATEMENTS = [
    # 1. Add 'lecturer' to role constraint
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check",
    "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('intern', 'supervisor', 'admin', 'lecturer'))",

    # 2. Add school & department columns
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS school VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100)",
    "CREATE INDEX IF NOT EXISTS idx_users_school ON users(school)",

    # 3. Drop UNIQUE on student_id (intern and supervisor share the same ID)
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_student_id_key",

    # 4. lecturer_intern_assignments table
    """CREATE TABLE IF NOT EXISTS lecturer_intern_assignments (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        intern_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(intern_id)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_lia_lecturer ON lecturer_intern_assignments(lecturer_id)",
    "CREATE INDEX IF NOT EXISTS idx_lia_intern   ON lecturer_intern_assignments(intern_id)",

    # 5. Fix geofence default radius 2000 → 200
    "ALTER TABLE supervisor_geofences ALTER COLUMN radius_meters SET DEFAULT 200",

    # 6. Add password_reset_tokens if not exists (from 003_features.sql)
    """CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      VARCHAR(128) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used       BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )""",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_token ON password_reset_tokens(token)",
    "CREATE INDEX IF NOT EXISTS idx_prt_user ON password_reset_tokens(user_id)",
]

ok = 0
skipped = 0
for stmt in STATEMENTS:
    with engine.begin() as conn:
        try:
            conn.execute(text(stmt))
            preview = stmt.strip()[:80].replace('\n', ' ')
            print(f"  OK  : {preview}")
            ok += 1
        except Exception as e:
            preview = stmt.strip()[:60].replace('\n', ' ')
            print(f"  SKIP: {preview} => {str(e)[:60]}")
            skipped += 1

print(f"\nDone — {ok} applied, {skipped} skipped.")
