-- ============================================================
-- 002_seed.sql: Default admin account and site location
-- ============================================================

-- Default admin account (password: Admin@123)
-- Hash generated with raw bcrypt (rounds=12) — compatible with auth_service.py
INSERT INTO users (email, password_hash, full_name, role, status)
VALUES (
    'admin@mis.local',
    '$2b$12$AiEKpTStZEL9L9NXF1Qjx.fdVZ7XT6coPbo0B/ZxQnn0j/o7SYW7C',
    'System Administrator',
    'admin',
    'active'
) ON CONFLICT (email) DO NOTHING;

-- Default site location removed intentionally.
-- Supervisors must pin their own office location after account activation.
-- INSERT INTO site_locations ... (removed)
