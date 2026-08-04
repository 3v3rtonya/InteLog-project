"""Run 006_preregister.sql migration — add shell status."""
import sys
sys.path.insert(0, '.')
from backend.database import engine
from sqlalchemy import text

STATEMENTS = [
    # Add 'shell' to users status constraint
    "ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check",
    """ALTER TABLE users ADD CONSTRAINT users_status_check
       CHECK (status IN ('pending','active','suspended','waiting','shell'))""",
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
