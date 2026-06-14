-- SHAHID Database Schema — Year 1 MVP
-- Version: SRS v1.0 | June 2026
-- Platform: PostgreSQL 15 via Supabase
-- Features: Multi-tenancy, RLS, immutability constraints, audit triggers

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================
-- TENANT ISOLATION (Top level)
-- ==========================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    language_pref TEXT NOT NULL DEFAULT 'ar',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE tenants IS 'Top-level multi-tenancy isolation unit';

-- ==========================================
-- USERS & RBAC
-- ==========================================
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'project_manager', 'site_supervisor', 'field_operator', 'read_only');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    auth_id UUID UNIQUE, -- Links to Supabase Auth user
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'field_operator',
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role);

COMMENT ON TABLE users IS 'Application users with RBAC roles';

-- ==========================================
-- PROJECTS
-- ==========================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    gps_boundary GEOGRAPHY(POLYGON, 4326), -- GeoJSON boundary
    status TEXT NOT NULL DEFAULT 'active',
    baseline_schedule JSONB, -- Stored schedule JSON
    baseline_schedule_url TEXT, -- File reference if large
    alert_delay_threshold_days INT NOT NULL DEFAULT 1,
    alert_critical_delay_threshold_days INT NOT NULL DEFAULT 3,
    capture_frequency_hours INT NOT NULL DEFAULT 24,
    report_language TEXT NOT NULL DEFAULT 'ar',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_tenant ON projects(tenant_id);

COMMENT ON TABLE projects IS 'Construction projects managed by a PM';

-- ==========================================
-- ZONES (Hierarchical: Project > Floor > Room > ...)
-- ==========================================
CREATE TABLE zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_zone_id UUID REFERENCES zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level_type TEXT NOT NULL, -- e.g., 'project', 'floor', 'room', 'area'
    level_number INT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zones_project ON zones(project_id);
CREATE INDEX idx_zones_parent ON zones(parent_zone_id);

COMMENT ON TABLE zones IS 'Hierarchical grouping of capture points';

-- ==========================================
-- CAPTURE POINTS
-- ==========================================
CREATE TABLE capture_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    expected_stage TEXT, -- e.g., 'Foundations', 'Structure', 'MEP', 'Finishing'
    capture_frequency_hours INT NOT NULL DEFAULT 24,
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_capture_points_zone ON capture_points(zone_id);
CREATE INDEX idx_capture_points_active ON capture_points(is_active);

COMMENT ON TABLE capture_points IS 'Predefined physical locations requiring photo documentation';

-- ==========================================
-- PHOTOS (Immutable Core Record)
-- ==========================================
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capture_point_id UUID NOT NULL REFERENCES capture_points(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    file_url TEXT NOT NULL,
    file_size_bytes INT,
    captured_at TIMESTAMPTZ NOT NULL, -- NTP-synced, immutable
    gps_lat DECIMAL(10, 8) NOT NULL,  -- Immutable
    gps_lng DECIMAL(11, 8) NOT NULL, -- Immutable
    gps_accuracy DECIMAL(6, 2), -- meters
    hash_sha256 TEXT NOT NULL, -- Immutable cryptographic hash
    is_ntp_synced BOOLEAN NOT NULL DEFAULT true, -- false if device fell back to local clock
    device_id TEXT, -- Capturing device identifier
    device_model TEXT,
    local_path TEXT, -- Reference for local queue tracking
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    synced BOOLEAN NOT NULL DEFAULT true,
    -- These fields MUST NEVER be modified after insert
    CONSTRAINT photos_hash_length CHECK (LENGTH(hash_sha256) = 64)
);

CREATE INDEX idx_photos_capture_point ON photos(capture_point_id);
CREATE INDEX idx_photos_captured_at ON photos(captured_at);
CREATE INDEX idx_photos_user ON photos(user_id);

COMMENT ON TABLE photos IS 'Captured photo with immutable metadata per SRS FR-1';
COMMENT ON COLUMN photos.captured_at IS 'NTP-synchronized timestamp; IMMUTABLE after insert';
COMMENT ON COLUMN photos.gps_lat IS 'GPS latitude at capture time; IMMUTABLE after insert';
COMMENT ON COLUMN photos.gps_lng IS 'GPS longitude at capture time; IMMUTABLE after insert';
COMMENT ON COLUMN photos.hash_sha256 IS 'SHA-256 of original photo file; IMMUTABLE after insert';

-- ==========================================
-- AI RESULTS (Mutable, separate from immutable photo record)
-- ==========================================
CREATE TABLE ai_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    stage_classification TEXT,
    defect_flags JSONB DEFAULT '[]', -- Array of detected defects
    confidence_score DECIMAL(5, 4), -- 0.0000 to 1.0000
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reprocessed_at TIMESTAMPTZ,
    model_version TEXT NOT NULL DEFAULT 'v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(photo_id)
);

CREATE INDEX idx_ai_results_photo ON ai_results(photo_id);

COMMENT ON TABLE ai_results IS 'AI analysis results; mutable and reprocessable';

-- ==========================================
-- SNAGS (Defects / Issues)
-- ==========================================
CREATE TYPE snag_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE snag_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE snags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
    capture_point_id UUID REFERENCES capture_points(id) ON DELETE SET NULL,
    category TEXT NOT NULL, -- e.g., 'crack', 'water_damage', 'incomplete_work'
    severity snag_severity NOT NULL DEFAULT 'medium',
    status snag_status NOT NULL DEFAULT 'open',
    description TEXT,
    due_date DATE,
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_snags_project ON snags(project_id);
CREATE INDEX idx_snags_status ON snags(status);

-- ==========================================
-- REPORTS
-- ==========================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes INT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    triggered_by TEXT NOT NULL DEFAULT 'auto', -- 'auto' or 'manual'
    generated_by UUID REFERENCES users(id),
    report_data JSONB, -- Structured data for web rendering
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_project ON reports(project_id);
CREATE INDEX idx_reports_period ON reports(period_start, period_end);

-- ==========================================
-- NOTIFICATIONS
-- ==========================================
CREATE TYPE notification_type AS ENUM ('overdue_point', 'snag_flagged', 'report_ready', 'delay_alert', 'system');

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    payload JSONB NOT NULL, -- Flexible notification data
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

COMMENT ON TABLE notifications IS 'In-app and push notification records; retained 90 days';

-- ==========================================
-- AUDIT LOG (Immutable)
-- ==========================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    action TEXT NOT NULL, -- e.g., 'login', 'capture', 'create_project', 'modify_role'
    entity_type TEXT NOT NULL, -- e.g., 'photo', 'project', 'user'
    entity_id UUID, -- Reference to the affected entity
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

COMMENT ON TABLE audit_logs IS 'Full audit trail; immutable and append-only';

-- ==========================================
-- ELEMENTS (Year 2 schema foundation)
-- ==========================================
CREATE TABLE elements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    qr_code TEXT UNIQUE,
    name TEXT NOT NULL,
    specs JSONB,
    warranty_end DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_elements_zone ON elements(zone_id);
CREATE INDEX idx_elements_qr ON elements(qr_code) WHERE qr_code IS NOT NULL;

-- ==========================================
-- IMMUTABILITY GUARANTEES (FR-1.9, NFR-2.5)
-- ==========================================

-- Prevent any update to immutable photo fields
CREATE OR REPLACE FUNCTION enforce_photo_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.captured_at IS DISTINCT FROM NEW.captured_at THEN
        RAISE EXCEPTION 'captured_at is immutable: %', OLD.id;
    END IF;
    IF OLD.gps_lat IS DISTINCT FROM NEW.gps_lat THEN
        RAISE EXCEPTION 'gps_lat is immutable: %', OLD.id;
    END IF;
    IF OLD.gps_lng IS DISTINCT FROM NEW.gps_lng THEN
        RAISE EXCEPTION 'gps_lng is immutable: %', OLD.id;
    END IF;
    IF OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256 THEN
        RAISE EXCEPTION 'hash_sha256 is immutable: %', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_photo_immutability
    BEFORE UPDATE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION enforce_photo_immutability();

-- Prevent deletion of photos (WORM principle)
CREATE OR REPLACE FUNCTION prevent_photo_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Photo deletion is forbidden (WORM policy): %', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_photo_no_delete
    BEFORE DELETE ON photos
    FOR EACH ROW
    EXECUTE FUNCTION prevent_photo_delete();

-- ==========================================
-- AUDIT LOGGING TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Attempt to get current user from session variable (set by app)
    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    BEGIN
        v_tenant_id := NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_tenant_id := NULL;
    END;

    INSERT INTO audit_logs (user_id, tenant_id, action, entity_type, entity_id, old_value, new_value, timestamp)
    VALUES (
        v_user_id,
        v_tenant_id,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        now()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply audit logging to critical tables
CREATE TRIGGER audit_tenants AFTER INSERT OR UPDATE OR DELETE ON tenants FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON projects FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_zones AFTER INSERT OR UPDATE OR DELETE ON zones FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_capture_points AFTER INSERT OR UPDATE OR DELETE ON capture_points FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_photos AFTER INSERT OR UPDATE ON photos FOR EACH ROW EXECUTE FUNCTION log_audit(); -- No delete on photos
CREATE TRIGGER audit_snags AFTER INSERT OR UPDATE OR DELETE ON snags FOR EACH ROW EXECUTE FUNCTION log_audit();

-- ==========================================
-- UPDATED AT TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER updated_at_tenants BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_projects BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_zones BEFORE UPDATE ON zones FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_capture_points BEFORE UPDATE ON capture_points FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_ai_results BEFORE UPDATE ON ai_results FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_snags BEFORE UPDATE ON snags FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_elements BEFORE UPDATE ON elements FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- ROW LEVEL SECURITY (RLS) — Multi-tenancy
-- ==========================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE snags ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;

-- Helper: get current tenant_id from session
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper: get current user role from session
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_role', true), '')::user_role;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper: is super_admin?
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_user_role() = 'super_admin';
END;
$$ LANGUAGE plpgsql STABLE;

-- TENANTS: Super Admin sees all; tenant users see their own only
CREATE POLICY tenants_policy ON tenants
    FOR ALL
    USING (is_super_admin() OR id = current_tenant_id());

-- USERS: Tenant isolation
CREATE POLICY users_policy ON users
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id());

-- PROJECTS: Tenant isolation
CREATE POLICY projects_policy ON projects
    FOR ALL
    USING (is_super_admin() OR tenant_id = current_tenant_id());

-- ZONES: Through project tenant
CREATE POLICY zones_policy ON zones
    FOR ALL
    USING (
        is_super_admin() OR
        EXISTS (SELECT 1 FROM projects p WHERE p.id = zones.project_id AND p.tenant_id = current_tenant_id())
    );

-- CAPTURE POINTS: Through zone > project tenant
CREATE POLICY capture_points_policy ON capture_points
    FOR ALL
    USING (
        is_super_admin() OR
        EXISTS (
            SELECT 1 FROM zones z
            JOIN projects p ON p.id = z.project_id
            WHERE z.id = capture_points.zone_id AND p.tenant_id = current_tenant_id()
        )
    );

-- PHOTOS: Tenant isolation + role restrictions (FO sees only their own)
CREATE POLICY photos_policy ON photos
    FOR ALL
    USING (
        is_super_admin() OR
        EXISTS (
            SELECT 1 FROM capture_points cp
            JOIN zones z ON z.id = cp.zone_id
            JOIN projects p ON p.id = z.project_id
            WHERE cp.id = photos.capture_point_id AND p.tenant_id = current_tenant_id()
            AND (
                current_user_role() != 'field_operator' OR photos.user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
            )
        )
    );

-- AI RESULTS: Same as photos (tenant isolation)
CREATE POLICY ai_results_policy ON ai_results
    FOR ALL
    USING (
        is_super_admin() OR
        EXISTS (
            SELECT 1 FROM photos ph
            JOIN capture_points cp ON cp.id = ph.capture_point_id
            JOIN zones z ON z.id = cp.zone_id
            JOIN projects p ON p.id = z.project_id
            WHERE ph.id = ai_results.photo_id AND p.tenant_id = current_tenant_id()
        )
    );

-- SNAGS: Tenant isolation
CREATE POLICY snags_policy ON snags
    FOR ALL
    USING (
        is_super_admin() OR
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = snags.project_id AND p.tenant_id = current_tenant_id()
        )
    );

-- REPORTS: Tenant isolation
CREATE POLICY reports_policy ON reports
    FOR ALL
    USING (
        is_super_admin() OR
        EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = reports.project_id AND p.tenant_id = current_tenant_id()
        )
    );

-- NOTIFICATIONS: User sees only their own
CREATE POLICY notifications_policy ON notifications
    FOR ALL
    USING (
        user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
        OR is_super_admin()
    );

-- AUDIT LOGS: Tenant isolation + super admin
CREATE POLICY audit_logs_policy ON audit_logs
    FOR ALL
    USING (
        is_super_admin() OR
        tenant_id = current_tenant_id()
    );

-- ELEMENTS: Tenant isolation
CREATE POLICY elements_policy ON elements
    FOR ALL
    USING (
        is_super_admin() OR
        EXISTS (
            SELECT 1 FROM zones z
            JOIN projects p ON p.id = z.project_id
            WHERE z.id = elements.zone_id AND p.tenant_id = current_tenant_id()
        )
    );

-- ==========================================
-- SEED DATA: Demo Tenant & Admin
-- ==========================================
INSERT INTO tenants (id, name, language_pref)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Demo Construction Co.', 'ar');

-- Note: In production, users should be created via Supabase Auth and linked by auth_id
-- This seed is for local development schema validation only

COMMIT;
