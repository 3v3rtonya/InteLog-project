-- Migration 008: Drop otp_tokens table
-- OTP functionality was removed in a prior version; this cleans up the dead table.
DROP TABLE IF EXISTS otp_tokens;
