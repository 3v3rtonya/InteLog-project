-- Migration 011: Add supervisor_grade to weekly_summaries
ALTER TABLE weekly_summaries
    ADD COLUMN IF NOT EXISTS supervisor_grade INTEGER
    CHECK (supervisor_grade >= 0 AND supervisor_grade <= 10);
