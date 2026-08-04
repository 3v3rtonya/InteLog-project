-- 001_initial.sql: Create all tables with indexes

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'intern' CHECK (role IN ('intern','supervisor','admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE logbook_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intern_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entry_date DATE NOT NULL,
    activities_performed TEXT NOT NULL,
    solutions_offered TEXT NOT NULL,
    solutions_scrubbed TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    is_onsite BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','pending_approval','otp_sent','approved','rejected')),
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    rejection_reason TEXT,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE log_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_id UUID NOT NULL REFERENCES logbook_entries(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    original_filename VARCHAR(255),
    file_size INTEGER,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE otp_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    log_id UUID NOT NULL REFERENCES logbook_entries(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_hash VARCHAR(64) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE site_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 200,
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_supervisor ON users(supervisor_id);
CREATE INDEX idx_logs_intern ON logbook_entries(intern_id);
CREATE INDEX idx_logs_status ON logbook_entries(status);
CREATE INDEX idx_logs_flagged ON logbook_entries(is_flagged);
CREATE INDEX idx_otp_log ON otp_tokens(log_id);
