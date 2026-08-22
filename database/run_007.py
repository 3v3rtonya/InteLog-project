"""Run 007 - AI Classification and Institutions."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.database import engine
from sqlalchemy import text

STATEMENTS = [
    # 1. Institutions
    """CREATE TABLE IF NOT EXISTS institutions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
    )""",
    
    # 2. Add institution_id to users
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL",
    
    # 3. Add AI fields to logbook_entries
    "ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS ai_classification VARCHAR(50)",
    "ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS ai_confidence FLOAT",
    "ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS ai_feedback TEXT",

    # 4. Update users role check
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check",
    """ALTER TABLE users ADD CONSTRAINT users_role_check 
       CHECK (role IN ('super_admin', 'system_admin', 'admin', 'lecturer', 'supervisor', 'intern'))"""
]

if __name__ == "__main__":
    ok = skipped = 0
    for stmt in STATEMENTS:
        with engine.begin() as conn:
            try:
                conn.execute(text(stmt))
                print(f"  OK  : {stmt.strip()[:80].replace(chr(10),' ')}")
                ok += 1
            except Exception as e:
                print(f"  SKIP: {str(e).strip()[:80].replace(chr(10),' ')}")
                skipped += 1

    print(f"\nDone — {ok} applied, {skipped} skipped.")
