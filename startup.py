"""
startup.py - Production startup script for Render.
Runs all migrations, seeds admin account, then starts uvicorn.
"""
import sys
import os
import subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.database import engine
from sqlalchemy import text

def run_sql(stmt, label=""):
    try:
        with engine.begin() as conn:
            conn.execute(text(stmt))
        print(f"  OK: {label or stmt[:60]}")
        return True
    except Exception as e:
        msg = str(e)
        if any(x in msg for x in ["already exists", "duplicate", "does not exist"]):
            print(f"  SKIP: {label or stmt[:60]}")
        else:
            print(f"  ERR: {label or stmt[:60]} => {msg[:80]}")
        return False

def run_sql_file(path, label):
    print(f"\n--- {label} ---")
    if not os.path.exists(path):
        print(f"  NOT FOUND: {path}")
        return
    with open(path, "r") as f:
        content = f.read()
    stmts = [s.strip() for s in content.split(";") if s.strip()]
    for stmt in stmts:
        run_sql(stmt, stmt[:60])

def migrate():
    print("\n========================================")
    print("InteLog MIS - Running Migrations")
    print("========================================")

    # Core SQL migrations
    for path, label in [
        ("database/001_initial.sql",                   "001 Initial schema"),
        ("database/002_seed.sql",                      "002 Seed data"),
        ("database/003_features.sql",                  "003 Features"),
        ("database/004_roles.sql",                     "004 Roles"),
        ("database/005_attendance.sql",                "005 Attendance"),
        ("database/006_add_isOnsite_to_attendance.sql","006 isOnsite"),
        ("database/007_remove_rejection_reason.sql",   "007 Rejection reason"),
        ("database/008_drop_otp_tokens.sql",           "008 OTP tokens"),
        ("database/009_drop_site_locations.sql",       "009 Site locations"),
        ("database/010_add_is_coordinator.sql",        "010 Coordinator"),
        ("database/011_add_supervisor_grade.sql",      "011 Supervisor grade"),
    ]:
        run_sql_file(path, label)

    # Programmatic migrations
    print("\n--- Extra schema patches ---")

    patches = [
        ("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(50)", "student_id col"),
        ("ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id_status VARCHAR(20) DEFAULT 'unlinked'", "student_id_status col"),
        ("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path TEXT", "avatar_path col"),
        ("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_coordinator BOOLEAN NOT NULL DEFAULT FALSE", "is_coordinator col"),
        ("CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id)", "student_id index"),
        ("""CREATE TABLE IF NOT EXISTS attendance_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            intern_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            clock_in_time TIMESTAMPTZ,
            clock_out_time TIMESTAMPTZ,
            clock_in_location TEXT,
            clock_out_location TEXT,
            clock_in_count INTEGER NOT NULL DEFAULT 0,
            is_onsite BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_attendance_intern_date UNIQUE (intern_id, date)
        )""", "attendance_records table"),
        ("""CREATE TABLE IF NOT EXISTS weekly_summaries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            intern_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
            week_start_date DATE NOT NULL,
            week_end_date DATE NOT NULL,
            summary_text TEXT NOT NULL,
            supervisor_feedback TEXT,
            supervisor_grade INTEGER CHECK (supervisor_grade >= 0 AND supervisor_grade <= 10),
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            submitted_at TIMESTAMPTZ,
            reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )""", "weekly_summaries table"),
        ("""CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token VARCHAR(128) UNIQUE NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )""", "password_reset_tokens table"),
        ("ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS clock_in_count INTEGER NOT NULL DEFAULT 0", "clock_in_count col"),
        ("ALTER TABLE weekly_summaries ADD COLUMN IF NOT EXISTS supervisor_grade INTEGER CHECK (supervisor_grade >= 0 AND supervisor_grade <= 10)", "supervisor_grade col"),
    ]

    for stmt, label in patches:
        run_sql(stmt, label)

    print("\n--- Admin account ---")
    try:
        from backend.models import User
        from backend.services.auth_service import hash_password
        from backend.database import SessionLocal
        db = SessionLocal()
        admin = db.query(User).filter(User.email == "admin@mis.local").first()
        if not admin:
            admin = User(
                email="admin@mis.local",
                full_name="System Administrator",
                role="admin",
                status="active",
                password_hash=hash_password("Admin@123"),
            )
            db.add(admin)
            db.commit()
            print("  OK: admin@mis.local created (password: Admin@123)")
        else:
            print("  SKIP: admin@mis.local already exists")
        db.close()
    except Exception as e:
        print(f"  ERR: admin creation failed: {e}")

    print("\n========================================")
    print("Migrations complete - starting server")
    print("========================================\n")

if __name__ == "__main__":
    migrate()
    # Start uvicorn
    port = os.environ.get("PORT", "8000")
    os.execvp("uvicorn", ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", port])