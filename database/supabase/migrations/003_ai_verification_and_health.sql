-- SHAHID Database Schema Update: AI Verification & Health
-- Version: SRS v1.1

BEGIN;

-- 1. Add verification status to AI Results
-- This allows PMs to confirm or reject AI-detected defects
ALTER TABLE ai_results 
ADD COLUMN verification_status TEXT DEFAULT 'pending',
ADD COLUMN verified_by UUID REFERENCES users(id),
ADD COLUMN verified_at TIMESTAMPTZ;

-- Add a constraint to ensure only valid statuses are used
ALTER TABLE ai_results 
ADD CONSTRAINT check_verification_status 
CHECK (verification_status IN ('pending', 'confirmed', 'rejected', 'ignored'));

-- 2. Add 'is_ntp_verified' to photos to track clock integrity
ALTER TABLE photos 
ADD COLUMN ntp_drift_ms INT DEFAULT 0,
ADD COLUMN ntp_verified BOOLEAN DEFAULT false;

-- 3. Add a system_health table for observability
CREATE TABLE system_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
    last_check TIMESTAMPTZ NOT NULL DEFAULT now(),
    metrics JSONB,
    error_message TEXT
);

CREATE INDEX idx_health_service ON system_health(service_name);

COMMIT;
