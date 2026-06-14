-- SHAHID Demo Data Seed: 3 Specific Projects
-- Target: PostgreSQL 15 / Supabase

BEGIN;

DO $$
DECLARE
    v_tenant_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    v_user_id UUID;
BEGIN
    -- Ensure a PM user exists for the demo tenant
    INSERT INTO users (tenant_id, name, email, role)
    VALUES (v_tenant_id, 'Sami Project Manager', 'sami@demo.shahid.local', 'project_manager')
    ON CONFLICT (tenant_id, email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_user_id;

    -- ==========================================
    -- PROJECT 1: Royal Palace Renovation
    -- ==========================================
    DECLARE
        v_p1_id UUID := uuid_generate_v4();
        v_z1_id UUID;
    BEGIN
        INSERT INTO projects (id, tenant_id, name, address, status, capture_frequency_hours, report_language, created_by)
        VALUES (v_p1_id, v_tenant_id, 'Royal Palace Renovation', 'Baghdad Central', 'active', 24, 'ar', v_user_id);

        INSERT INTO zones (project_id, name, level_type, level_number)
        VALUES (v_p1_id, 'Grand Ballroom', 'area', 1) RETURNING id INTO v_z1_id;

        INSERT INTO capture_points (zone_id, name, expected_stage) VALUES 
        (v_z1_id, 'Main Chandelier Base', 'Finishing'),
        (v_z1_id, 'Ceiling Support A', 'Structure');
    END;

    -- ==========================================
    -- PROJECT 2: Smart City Data Center
    -- ==========================================
    DECLARE
        v_p2_id UUID := uuid_generate_v4();
        v_z1_id UUID;
    BEGIN
        INSERT INTO projects (id, tenant_id, name, address, status, capture_frequency_hours, report_language, created_by)
        VALUES (v_p2_id, v_tenant_id, 'Smart City Data Center', 'Basra Tech Zone', 'active', 12, 'en', v_user_id);

        INSERT INTO zones (project_id, name, level_type, level_number)
        VALUES (v_p2_id, 'Server Hall A', 'room', 1) RETURNING id INTO v_z1_id;

        INSERT INTO capture_points (zone_id, name, expected_stage) VALUES 
        (v_z1_id, 'Cooling Unit 1', 'MEP'),
        (v_z1_id, 'Power Grid Entry', 'MEP');
    END;

    -- ==========================================
    -- PROJECT 3: Al-Kindi Medical Complex
    -- ==========================================
    DECLARE
        v_p3_id UUID := uuid_generate_v4();
        v_z1_id UUID;
    BEGIN
        INSERT INTO projects (id, tenant_id, name, address, status, capture_frequency_hours, report_language, created_by)
        VALUES (v_p3_id, v_tenant_id, 'Al-Kindi Medical Complex', 'Najaf Health District', 'paused', 48, 'ar', v_user_id);

        INSERT INTO zones (project_id, name, level_type, level_number)
        VALUES (v_p3_id, 'ICU Wing', 'area', 1) RETURNING id INTO v_z1_id;

        INSERT INTO capture_points (zone_id, name, expected_stage) VALUES 
        (v_z1_id, 'Oxygen Line Hub', 'MEP'),
        (v_z1_id, 'Patient Room 101', 'Finishing');
    END;
END $$;

COMMIT;
