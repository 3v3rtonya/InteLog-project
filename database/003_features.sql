-- ============================================================
-- 003_features.sql
-- New features: Student ID linking, per-supervisor geofence,
-- notifications, profile management, OTP removal,
-- DB-backed password reset tokens.
-- Run this ONCE against your existing intern_mis database.
-- ============================================================

-- ── 1. Add student_id to users ────────────────────────────────────────────
-- NOTE: student_id is NOT UNIQUE — intern and their supervisor deliberately
-- share the same student_id. That shared value is the auto-linking key.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS student_id        VARCHAR(50),
    ADD COLUMN IF NOT EXISTS student_id_status VARCHAR(20) DEFAULT 'unlinked',
    ADD COLUMN IF NOT EXISTS avatar_path       TEXT;

-- Drop the UNIQUE constraint if it was added by a previous migration run
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_student_id_key;

-- Index for fast student_id lookups during signup linking (not unique)
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id);

-- ── 2. Per-supervisor geofence table ──────────────────────────────────────
-- Each supervisor pins their own office location.
CREATE TABLE IF NOT EXISTS supervisor_geofences (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    latitude      DECIMAL(10,8) NOT NULL,
    longitude     DECIMAL(11,8) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 2000,
    is_active     BOOLEAN DEFAULT TRUE,
    pinned_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(supervisor_id)
);

CREATE INDEX IF NOT EXISTS idx_geofence_supervisor ON supervisor_geofences(supervisor_id);

-- ── 3. Geofence re-pin audit log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geofence_repin_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_latitude  DECIMAL(10,8),
    old_longitude DECIMAL(11,8),
    new_latitude  DECIMAL(10,8) NOT NULL,
    new_longitude DECIMAL(11,8) NOT NULL,
    reason        TEXT NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 4. Notifications table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50)  NOT NULL,
    title      VARCHAR(255) NOT NULL,
    body       TEXT         NOT NULL,
    link_id    UUID,
    link_type  VARCHAR(50),
    is_read    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);

-- ── 5. DB-backed password reset tokens ────────────────────────────────────
-- Replaces in-memory dict — survives restarts and works across workers.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used       BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_token  ON password_reset_tokens(token);
CREATE        INDEX IF NOT EXISTS idx_prt_user   ON password_reset_tokens(user_id);

-- ── 6. Update logbook_entries status — remove otp_sent ────────────────────
ALTER TABLE logbook_entries
    DROP CONSTRAINT IF EXISTS logbook_entries_status_check;

ALTER TABLE logbook_entries
    ADD CONSTRAINT logbook_entries_status_check
    CHECK (status IN ('draft','pending_approval','approved','rejected'));

-- Migrate any existing otp_sent rows to pending_approval
UPDATE logbook_entries SET status = 'pending_approval' WHERE status = 'otp_sent';

-- ── 7. Add 'waiting' to users status ──────────────────────────────────────
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE users
    ADD CONSTRAINT users_status_check
    CHECK (status IN ('pending','active','suspended','waiting'));

-- ── 8. Convert naive timestamps to timestamptz on key columns ─────────────
ALTER TABLE users
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE
        USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE
        USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE logbook_entries
    ALTER COLUMN created_at    TYPE TIMESTAMP WITH TIME ZONE USING created_at    AT TIME ZONE 'UTC',
    ALTER COLUMN submitted_at  TYPE TIMESTAMP WITH TIME ZONE USING submitted_at  AT TIME ZONE 'UTC',
    ALTER COLUMN approved_at   TYPE TIMESTAMP WITH TIME ZONE USING approved_at   AT TIME ZONE 'UTC';

ALTER TABLE log_images
    ALTER COLUMN uploaded_at TYPE TIMESTAMP WITH TIME ZONE USING uploaded_at AT TIME ZONE 'UTC';
