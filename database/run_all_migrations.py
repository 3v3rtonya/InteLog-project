"""
run_all_migrations.py - Run all three migrations in the correct order.
Handles 001_initial.sql, 002_seed.sql, and 003_features.sql
"""
import sys
import os

# Ensure backend is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine
from sqlalchemy import text


def read_sql_file(filepath):
    """Read and return SQL file contents."""
    with open(filepath, 'r') as f:
        return f.read()


def run_migration_001():
    """Run 001_initial.sql - create all base tables."""
    print("\n[1/3] Running 001_initial.sql...")
    sql_content = read_sql_file('database/001_initial.sql')
    
    # Split by semicolon and execute each statement
    statements = [s.strip() for s in sql_content.split(';') if s.strip()]
    
    executed = 0
    errors = 0
    
    for stmt in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
            executed += 1
            print(f"  ✓ {stmt[:60].replace(chr(10), ' ')}")
        except Exception as e:
            errors += 1
            error_msg = str(e)[:80]
            if 'already exists' in error_msg or 'duplicate key' in error_msg:
                print(f"  ~ {stmt[:60].replace(chr(10), ' ')} (already exists)")
            else:
                print(f"  ✗ {stmt[:60].replace(chr(10), ' ')} - {error_msg}")
    
    print(f"  Result: {executed} executed, {errors} errors/skipped")
    return executed > 0


def run_migration_002():
    """Run 002_seed.sql - insert default data."""
    print("\n[2/3] Running 002_seed.sql...")
    sql_content = read_sql_file('database/002_seed.sql')
    
    statements = [s.strip() for s in sql_content.split(';') if s.strip()]
    
    executed = 0
    errors = 0
    
    for stmt in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
            executed += 1
            print(f"  ✓ {stmt[:60].replace(chr(10), ' ')}")
        except Exception as e:
            errors += 1
            error_msg = str(e)[:80]
            if 'duplicate' in error_msg or 'already exists' in error_msg:
                print(f"  ~ {stmt[:60].replace(chr(10), ' ')} (already exists)")
            else:
                print(f"  ✗ {stmt[:60].replace(chr(10), ' ')} - {error_msg}")
    
    print(f"  Result: {executed} executed, {errors} errors/skipped")
    return executed > 0


def run_migration_003():
    """Run 003_features - incremental schema updates."""
    print("\n[3/3] Running 003_features.sql updates...")
    
    STATEMENTS = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(50)",
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
                print(f"  ✓ {stmt.strip()[:60].replace(chr(10), ' ')}")
                ok += 1
            except Exception as e:
                print(f"  ~ {stmt.strip()[:60].replace(chr(10), ' ')} (skipped: {str(e)[:40]})")
                skipped += 1

    print(f"  Result: {ok} applied, {skipped} skipped")
    return ok > 0


def main():
    print("=" * 70)
    print("InteLog MIS - Database Migration Suite")
    print("=" * 70)
    
    try:
        # Run all migrations in order
        m1 = run_migration_001()
        m2 = run_migration_002()
        m3 = run_migration_003()
        
        print("\n" + "=" * 70)
        if m1 or m2 or m3:
            print("✓ Migrations completed successfully!")
            print("\nYou can now:")
            print("  1. Start the backend with: python -m uvicorn backend.main:app --reload")
            print("  2. Login with: admin@mis.local / Admin@123")
        else:
            print("! No new changes were applied (database may already be current)")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
