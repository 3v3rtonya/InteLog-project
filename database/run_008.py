"""Run 008 - Additional Logbook fields, Weekly Summaries, Clock-in System."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.database import engine, Base
from backend.models import WeeklySummary, AttendanceRecord
from sqlalchemy import text

STATEMENTS = [
    # 1. Add fields to logbook_entries
    "ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS problems_encountered TEXT",
    "ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS lessons_learned TEXT",
    "ALTER TABLE logbook_entries ADD COLUMN IF NOT EXISTS supervisor_comments TEXT",
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
                
    # Also trigger create_all so SQLAlchemy creates weekly_summaries and attendance_records
    print("Running Base.metadata.create_all for new models...")
    Base.metadata.create_all(bind=engine)
    
    print(f"\nDone — {ok} altered, {skipped} skipped.")
