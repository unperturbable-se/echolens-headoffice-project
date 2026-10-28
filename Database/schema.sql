CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN','FINANCE_REVIEWER','CONTENT_EDITOR','BRANCH_LEAD','HR_LEAD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_ur VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    address_en TEXT,
    address_ur TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT check_role_branch CHECK (
        (role = 'BRANCH_LEAD' AND branch_id IS NOT NULL)
        OR (role IN ('SUPER_ADMIN','FINANCE_REVIEWER','CONTENT_EDITOR') AND branch_id IS NULL)
        OR role = 'HR_LEAD'
    )
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES users(id) ON DELETE RESTRICT,
    title_en VARCHAR(255) NOT NULL,
    title_ur VARCHAR(255),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency CHAR(3) DEFAULT 'PKR' NOT NULL,
    collection_date DATE NOT NULL,
    status approval_status DEFAULT 'PENDING' NOT NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT check_review_state CHECK (
        (status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL)
        OR (status <> 'PENDING' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CONSTRAINT check_rejection_reason CHECK (
        status <> 'REJECTED' OR length(trim(coalesce(review_notes,''))) > 0
    ),
    CONSTRAINT check_no_self_review CHECK (reviewed_by IS DISTINCT FROM submitted_by)
);

CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    summary_en TEXT NOT NULL,
    summary_ur TEXT,
    total_members_active INT DEFAULT 0 NOT NULL CHECK (total_members_active >= 0),
    new_registrations INT DEFAULT 0 NOT NULL CHECK (new_registrations >= 0),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_branch_week UNIQUE (branch_id, week_start_date),
    CONSTRAINT check_week_range CHECK (week_end_date >= week_start_date)
);

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    full_name_en VARCHAR(255) NOT NULL,
    full_name_ur VARCHAR(255),
    cnic_or_id VARCHAR(50),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    joined_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    title_en VARCHAR(255) NOT NULL,
    title_ur VARCHAR(255) NOT NULL,
    content_en TEXT NOT NULL,
    content_ur TEXT NOT NULL,
    is_published BOOLEAN DEFAULT FALSE NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT check_published CHECK (NOT is_published OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_name VARCHAR(255) NOT NULL,
    sender_email CITEXT NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id UUID,
    ip_address INET,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE OR REPLACE FUNCTION prevent_audit_log_alteration() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_alteration();

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_alteration();

CREATE OR REPLACE FUNCTION update_timestamp_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['branches','users','collection_records','public_notices'] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_update_%1$s_timestamp ON %1$s', t);
        EXECUTE format('CREATE TRIGGER trg_update_%1$s_timestamp BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION update_timestamp_column()', t);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_members_cnic ON members(cnic_or_id) WHERE cnic_or_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_collections_status ON collection_records(status);
CREATE INDEX IF NOT EXISTS idx_collections_branch ON collection_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_collections_submitted ON collection_records(submitted_by);
CREATE INDEX IF NOT EXISTS idx_collections_reviewed ON collection_records(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_reports_submitted ON weekly_reports(submitted_by);
CREATE INDEX IF NOT EXISTS idx_members_branch ON members(branch_id);
CREATE INDEX IF NOT EXISTS idx_notices_created_by ON public_notices(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE SCHEMA IF NOT EXISTS api;
CREATE SCHEMA IF NOT EXISTS private;

DO $$ BEGIN
    CREATE ROLE app_backend LOGIN NOINHERIT PASSWORD 'CHANGE_ME';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, app_backend;
REVOKE ALL ON SCHEMA api, private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA api, private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA api TO app_backend;