-- SHAHID Demo Data Seed: 5 Projects
-- Target: PostgreSQL 15 / Supabase

BEGIN;

-- 1. Ensure we have a tenant and a user
-- Use the existing demo tenant from the initial schema
DO $$
DECLARE
    v_tenant_id UUID := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    v_user_id UUID;
BEGIN
    -- Create a Project Manager for this tenant
    INSERT INTO users (tenant_id, name, email, role)
    VALUES (v_tenant_id, 'Ahmed Manager', 'ahmed@demo.shahid.local', 'project_manager')
    ON CONFLICT (tenant_id, email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_user_id;

    -- ==========================================
    -- PROJECT 1: Al-Noor Residential Tower
    -- ==========================================
    DECLARE
        v_p1_id UUID := uuid_generate_v4();
        v_z1_id UUID;
        v_z2_id UUID;
    BEGIN
        INSERT INTO projects (id, tenant_id, name, address, status, capture_frequency_hours, report_language, created_by)
        VALUES (v_p1_id, v_tenant_id, 'Al-Noor Residential Tower', 'Al-Mansour, Baghdad', 'active', 24, 'ar', v_user_id);

        -- Root Zone
        INSERT INTO zones (project_id, name, level_type, level_number)
        VALUES (v_p1_id, 'Main Tower', 'project', 0) RETURNING id INTO v_z1_id;

        -- Floor 1
        INSERT INTO zones (project_id, parent_zone_id, name, level_type, level_number)
        VALUES (v_p1_id, v_z1_id, 'Floor 1', 'floor', 1) RETURNING id INTO v_z2_id;

        INSERT INTO capture_points (zone_id, name, expected_stage) VALUES 
        (v_z2_id, 'Entrance Lobby North', 'Finishing'),
        (v_z2_id, 'Elevator Core A', 'Structure'),
        (v_z2_id, 'Parking Entrance', 'Foundations');
    END;

    -- ==========================================
    -- PROJECT 2: Baghdad Metro Extension
    -- ==========================================
    DECLARE
        v_p2_id UUID := uuid_generate_v4();
        v_z1_id UUID;
    BEGIN
        INSERT INTO projects (id, tenant_id, name, address, status, capture_frequency_hours, report_language, created_by)
        VALUES (v_p2_id, v_tenant_id, 'Baghdad Metro Extension', 'Karrada, Baghdad', 'active', 12, 'ar', v_user_id);

        INSERT INTO zones (project_id, name, level_type, level_number)
        VALUES (v_p2_id, 'Station Alpha', 'project', 0) RETURNING id INTO v_z1_id;

        INSERT INTO capture_points (zone_id, name, expected_stage) VALUES 
        (v_z1_id, 'TBM Entry Point', 'Excavation'),
        (v_z1_id, 'Main Concourse West', 'Structure'),
        (v_z1_id, 'Platform Level 1', 'MEP');
    END;

    -- ==========================================
    -- PROJECT 3: Al-Rashid Bridge Rehabilitation
    -- ==========================================
    DECLARE
        v_p3_id UUID := uuid_generate_v4();
        v_z1_id UUID;
    BEGIN
        INSERT INTO projects (id, tenant_id, name, address, status, capture_frequency_hours, report_language, created_by)
        VALUES (v_p3_id, v_tenant_id, 'Al-Rashid Bridge Rehabilitation', 'Tigris River, Baghdad', 'paused', 48, 'ar', v_user_id);

        INSERT INTO zones (project_id, name, level_type, level_number)
        VALUES (v_p3_id, 'Central Span', 'project', 0) RETURNING id INTO v_z1_id;

        INSERT INTO capture_points (zone_id, name, expected_stage) VALUES 
        (v_z1_id, 'Pier 4 Base', 'Structure'),
        (v_z1_id, 'East Arch Support', 'Structure'),
        (v_z1_id, 'Deck Section B', 'Finishing');
    END;

    -- ==========================================
    -- PROJECT 4: National Library Expansion
    -- ==========================================
    DECLARE
        v_p4_id UUID := uuid_generate_v4();
        v_z1_id UUID;
    BEGIN
        INSERT INTO projects (id, tenant_id, name, address, status, capture_frequency_hours, report_language, created_by)
        VALUES (v_p4_id, v_tenant_id, 'National Library Expansion', 'Al-Salihiya, Baghdad', 'active', 24, 'ar', v_user_id);

        INSERT INTO zones (project_id, name, level_type, level_number)
        VALUES (v_p4_id, 'North Wing', 'project', 0) RETURNING id INTO v_z1_id;

        INSERT INTO capture_points (zone_id, name, expected_stage) VALUES 
        (v_z1_id, 'Archive Vault', 'Structure'),
        (v_z1_id, 'Reading Room A', 'Finishing'),
        (v_z1_id, 'External Facade', 'Finishing');
    END;

    -- ==========================================
    -- PROJECT 5: Modern Hospital Complex
    -- ==========================================
    DECLARE
        v_p5_id UUID := uuid_generate_v4();
        v_z1_id UUID;
    BEGIN
        INSERT INTO projects (id, tenant_id, name, address, status, capture_frequency_hours, report_language, created_by)
        VALUES (v_p5_id, v_tenant_id, 'Modern Hospital Complex', 'Basra City Center, Basra', 'active', 24, 'ar', v_user_id);

        INSERT INTO zones (project_id, name, level_type, level_number)
        VALUES (v_p5_id, 'Surgical Wing', 'project', 0) RETURNING id INTO v_z1_id;

        INSERT INTO capture_points (zone_id, name, expected_stage) VALUES 
        (v_z1_id, 'Operating Theater 1', 'MEP'),
        (v_z1_id, 'Sterilization Unit', 'MEP'),
        (v_z1_id, 'Patient Recovery Zone', 'Finishing');
    END;
END $$;

COMMIT;
