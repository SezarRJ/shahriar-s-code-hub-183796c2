-- ============================================================
-- SHAHID Migration 002: MFA Fields + User-Project Assignment
-- Version: 1.0 | June 2026
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT, ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ;
COMMENT ON COLUMN users.mfa_secret IS 'Encrypted TOTP secret (RFC 6238). Encrypted with AES-256-KMS in production. Only stored for roles requiring MFA: tenant_admin, project_manager, super_admin.';
COMMENT ON COLUMN users.mfa_enabled_at IS 'Timestamp when MFA was first enabled. Used for audit trail.';

CREATE TABLE IF NOT EXISTS user_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    role_override user_role,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(user_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_user_projects_user ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project ON user_projects(project_id);
COMMENT ON TABLE user_projects IS 'Junction table linking users to projects with assignment metadata. Enforces FO only sees assigned projects.';
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_projects_policy ON user_projects FOR ALL USING (is_super_admin() OR EXISTS (SELECT 1 FROM projects p WHERE p.id = user_projects.project_id AND p.tenant_id = current_tenant_id()));

CREATE TABLE IF NOT EXISTS capture_point_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capture_point_id UUID NOT NULL REFERENCES capture_points(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'pending')),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by UUID NOT NULL REFERENCES users(id),
    route_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_capture_point_status_history_cp ON capture_point_status_history(capture_point_id);
CREATE INDEX IF NOT EXISTS idx_capture_point_status_history_route ON capture_point_status_history(route_id);
COMMENT ON TABLE capture_point_status_history IS 'Audit trail of capture point status changes: Completed, Missed, or Pending. Supports FR-1.10 and schedule compliance tracking.';
ALTER TABLE capture_point_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_point_status_history_policy ON capture_point_status_history FOR ALL USING (is_super_admin() OR EXISTS (SELECT 1 FROM capture_points cp JOIN zones z ON z.id = cp.zone_id JOIN projects p ON p.id = z.project_id WHERE cp.id = capture_point_status_history.capture_point_id AND p.tenant_id = current_tenant_id()));

CREATE TABLE IF NOT EXISTS ai_result_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ai_result_id UUID NOT NULL REFERENCES ai_results(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    stage_classification TEXT,
    defect_flags JSONB DEFAULT '[]',
    confidence_score DECIMAL(5, 4),
    model_version TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_result_history_ai_result ON ai_result_history(ai_result_id);
CREATE INDEX IF NOT EXISTS idx_ai_result_history_photo ON ai_result_history(photo_id);
COMMENT ON TABLE ai_result_history IS 'Versioned history of AI analysis results. Enables audit trail and legal defensibility of AI predictions over time.';
ALTER TABLE ai_result_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_result_history_policy ON ai_result_history FOR ALL USING (is_super_admin() OR EXISTS (SELECT 1 FROM photos p JOIN capture_points cp ON cp.id = p.capture_point_id JOIN zones z ON z.id = cp.zone_id JOIN projects pr ON pr.id = z.project_id WHERE p.id = ai_result_history.photo_id AND pr.tenant_id = current_tenant_id()));

CREATE TRIGGER audit_user_projects AFTER INSERT OR UPDATE OR DELETE ON user_projects FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_capture_point_status_history AFTER INSERT OR UPDATE OR DELETE ON capture_point_status_history FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER audit_ai_result_history AFTER INSERT OR UPDATE OR DELETE ON ai_result_history FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER updated_at_user_projects BEFORE UPDATE ON user_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_capture_point_status_history BEFORE UPDATE ON capture_point_status_history FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER updated_at_ai_result_history BEFORE UPDATE ON ai_result_history FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
