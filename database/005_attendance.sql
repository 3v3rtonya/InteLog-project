-- ============================================================
-- 005_attendance.sql
-- Features:
--   1. Attachment period fields on users (interns)
--   2. absence_requests table
--   3. non_working_days table
-- ============================================================

-- ── 1. Attachment period on users ────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS attachment_start    DATE,
    ADD COLUMN IF NOT EXISTS attachment_end      DATE,
    ADD COLUMN IF NOT EXISTS date_change_count   INTEGER NOT NULL DEFAULT 0;

-- ── 2. Absence requests ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS absence_requests (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intern_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date             DATE NOT NULL,
    type             VARCHAR(20) NOT NULL
                     CHECK (type IN ('sick','day_off','emergency','half_day')),
    reason           TEXT NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','acknowledged','rejected')),
    acknowledged_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at  TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- one absence request per intern per date
    UNIQUE (intern_id, date)
);

CREATE INDEX IF NOT EXISTS idx_absence_intern ON absence_requests(intern_id);
CREATE INDEX IF NOT EXISTS idx_absence_date   ON absence_requests(date);

-- ── 3. Non-working days ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS non_working_days (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date        DATE NOT NULL UNIQUE,
    type        VARCHAR(20) NOT NULL DEFAULT 'public_holiday'
                CHECK (type IN ('public_holiday','custom')),
    name        VARCHAR(255) NOT NULL,
    year        INTEGER NOT NULL,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nwd_year ON non_working_days(year);
CREATE INDEX IF NOT EXISTS idx_nwd_date ON non_working_days(date);
