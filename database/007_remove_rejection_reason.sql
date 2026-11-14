-- Migration 007: Remove rejection_reason column from logbook_entries
-- The rejection_reason field is no longer used; logbook feedback is now
-- handled via supervisor_comments and the weekly summary review workflow.

ALTER TABLE logbook_entries DROP COLUMN IF EXISTS rejection_reason;
