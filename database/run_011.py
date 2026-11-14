"""Run 011_add_supervisor_grade.sql migration — add supervisor_grade to weekly_summaries."""
import sys
sys.path.insert(0, '.')
from backend.database import engine
from sqlalchemy import text

STATEMENTS = [
    "ALTER TABLE weekly_summaries ADD COLUMN IF NOT EXISTS supervisor_grade INTEGER CHECK (supervisor_grade >= 0 AND supervisor_grade <= 10)",
]

ok = skipped = 0
for stmt in STATEMENTS:
    with engine.begin() as conn:
        try:
            conn.execute(text(stmt))
            print(f"  OK  : {stmt.strip()[:80].replace(chr(10),' ')}")
            ok += 1
        except Exception as e:
            print(f"  SKIP: {str(e)[:80]}")
            skipped += 1

print(f"\nDone — {ok} applied, {skipped} skipped.")
