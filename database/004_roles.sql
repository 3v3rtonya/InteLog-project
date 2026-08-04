-- ============================================================
-- 004_roles.sql
-- New features:
--   1. Add 'lecturer' role to users role check constraint
--   2. Add school & department columns to users
--   3. Create lecturer_intern_assignments table
--   4. Fix geofence default radius from 2000 → 200
-- Run ONCE against your existing intern_mis database.
-- ============================================================

-- ── 1. Add 'lecturer' to users role constraint ────────────────────────────
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('intern', 'supervisor', 'admin', 'lecturer'));

-- ── 2. Add school & department columns ───────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS school     VARCHAR(100),
    ADD COLUMN IF NOT EXISTS department VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_users_school ON users(school);

-- ── 3. Lecturer ↔ intern assignment table ─────────────────────────────────
-- Each intern is assigned to at most one lecturer (UNIQUE on intern_id).
CREATE TABLE IF NOT EXISTS lecturer_intern_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lecturer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    intern_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(intern_id)   -- each intern assigned to at most one lecturer
);

CREATE INDEX IF NOT EXISTS idx_lia_lecturer ON lecturer_intern_assignments(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_lia_intern   ON lecturer_intern_assignments(intern_id);

-- ── 4. Fix supervisor_geofences default radius ────────────────────────────
ALTER TABLE supervisor_geofences
    ALTER COLUMN radius_meters SET DEFAULT 200;
