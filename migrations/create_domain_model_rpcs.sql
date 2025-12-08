-- Migration: Domain Model RPC Functions
-- Purpose: Visit creation, BOM snapshots, service amendments
-- Date: 2024-12-08

-- ============================================================================
-- 1. CREATE VISIT FOR JOB
-- ============================================================================

CREATE OR REPLACE FUNCTION create_visit(
    p_job_id UUID,
    p_scheduled_start TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_visit_id UUID;
    v_visit_number INT;
    v_tenant_id UUID;
BEGIN
    -- Get tenant from job
    SELECT tenant_id INTO v_tenant_id FROM jobs WHERE id = p_job_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;
    
    -- Get next visit number
    SELECT COALESCE(MAX(visit_number), 0) + 1 INTO v_visit_number
    FROM visits WHERE job_id = p_job_id;
    
    -- Create visit
    INSERT INTO visits (job_id, visit_number, scheduled_start, status)
    VALUES (p_job_id, v_visit_number, p_scheduled_start, 'Scheduled')
    RETURNING id INTO v_visit_id;
    
    RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_visit(UUID, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- 2. CREATE BOM SNAPSHOT FOR JOB
-- ============================================================================

CREATE OR REPLACE FUNCTION create_bom_snapshot(p_job_id UUID)
RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
    v_property_id UUID;
    v_snapshot_data JSONB;
BEGIN
    -- Get property from job
    SELECT property_id INTO v_property_id FROM jobs WHERE id = p_job_id;
    
    IF v_property_id IS NULL THEN
        RAISE EXCEPTION 'Job not found or has no property: %', p_job_id;
    END IF;
    
    -- Build snapshot from current property inventory
    SELECT jsonb_agg(jsonb_build_object(
        'item_name', item_name,
        'quantity', quantity,
        'category', category
    ))
    INTO v_snapshot_data
    FROM property_inventory
    WHERE property_id = v_property_id;
    
    -- Default to empty array if no inventory
    v_snapshot_data := COALESCE(v_snapshot_data, '[]'::jsonb);
    
    -- Insert snapshot
    INSERT INTO bom_snapshots (job_id, snapshot_data)
    VALUES (p_job_id, v_snapshot_data)
    RETURNING id INTO v_snapshot_id;
    
    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_bom_snapshot(UUID) TO authenticated;

-- ============================================================================
-- 3. RECORD SERVICE AMENDMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION record_service_amendment(
    p_service_opportunity_id UUID,
    p_amendment_type TEXT,  -- 'job_added' or 'job_removed'
    p_job_id UUID,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_amendment_id UUID;
    v_person_id UUID;
BEGIN
    -- Get person from auth context
    SELECT p.id INTO v_person_id
    FROM people p
    WHERE p.user_id = auth.uid();
    
    IF v_person_id IS NULL THEN
        RAISE EXCEPTION 'User not linked to person record';
    END IF;
    
    -- Validate amendment type
    IF p_amendment_type NOT IN ('job_added', 'job_removed') THEN
        RAISE EXCEPTION 'Invalid amendment type: %', p_amendment_type;
    END IF;
    
    -- Insert amendment
    INSERT INTO service_amendments (
        service_opportunity_id,
        amendment_type,
        job_id,
        reason,
        amended_by
    ) VALUES (
        p_service_opportunity_id,
        p_amendment_type,
        p_job_id,
        p_reason,
        v_person_id
    )
    RETURNING id INTO v_amendment_id;
    
    RETURN v_amendment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_service_amendment(UUID, TEXT, UUID, TEXT) TO authenticated;

-- ============================================================================
-- 4. CREATE JOB WITH AUTO-VISIT AND BOM SNAPSHOT
-- ============================================================================

CREATE OR REPLACE FUNCTION create_job_complete(
    p_service_opportunity_id UUID,
    p_job_template_id UUID,
    p_title TEXT,
    p_scheduled_start TIMESTAMPTZ DEFAULT NULL,
    p_assigned_person_ids UUID[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_job_id UUID;
    v_visit_id UUID;
    v_snapshot_id UUID;
    v_tenant_id UUID;
    v_property_id UUID;
    v_job_type TEXT;
    v_person_id UUID;
BEGIN
    -- Get tenant and property from service opportunity
    SELECT tenant_id, property_id 
    INTO v_tenant_id, v_property_id
    FROM service_opportunities 
    WHERE id = p_service_opportunity_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Service opportunity not found: %', p_service_opportunity_id;
    END IF;
    
    -- Get job type from template
    SELECT type INTO v_job_type FROM job_templates WHERE id = p_job_template_id;
    
    -- Create job
    INSERT INTO jobs (
        tenant_id,
        service_opportunity_id,
        property_id,
        title,
        type,
        status
    ) VALUES (
        v_tenant_id,
        p_service_opportunity_id,
        v_property_id,
        p_title,
        v_job_type,
        'Pending'
    )
    RETURNING id INTO v_job_id;
    
    -- Create first visit
    v_visit_id := create_visit(v_job_id, p_scheduled_start);
    
    -- Create BOM snapshot (for kitting jobs)
    IF v_job_type = 'Kitting' THEN
        v_snapshot_id := create_bom_snapshot(v_job_id);
    END IF;
    
    -- Assign workers if provided
    IF p_assigned_person_ids IS NOT NULL THEN
        FOREACH v_person_id IN ARRAY p_assigned_person_ids LOOP
            INSERT INTO job_assignments (job_id, person_id, status)
            VALUES (v_job_id, v_person_id, 'assigned')
            ON CONFLICT (job_id, person_id) DO NOTHING;
        END LOOP;
    END IF;
    
    -- Record amendment
    PERFORM record_service_amendment(
        p_service_opportunity_id,
        'job_added',
        v_job_id,
        'Job created: ' || p_title
    );
    
    RETURN jsonb_build_object(
        'job_id', v_job_id,
        'visit_id', v_visit_id,
        'bom_snapshot_id', v_snapshot_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_job_complete(UUID, UUID, TEXT, TIMESTAMPTZ, UUID[]) TO authenticated;

-- ============================================================================
-- 5. LOG WORKER STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_worker_status(
    p_visit_id UUID,
    p_status TEXT,
    p_latitude NUMERIC DEFAULT NULL,
    p_longitude NUMERIC DEFAULT NULL,
    p_device_info JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_person_id UUID;
    v_visit_status TEXT;
BEGIN
    -- Get person from auth context
    SELECT p.id INTO v_person_id
    FROM people p
    WHERE p.user_id = auth.uid();
    
    IF v_person_id IS NULL THEN
        RAISE EXCEPTION 'User not linked to person record';
    END IF;
    
    -- Validate status
    IF p_status NOT IN ('On My Way', 'Started', 'Paused', 'Finished', 'No-show') THEN
        RAISE EXCEPTION 'Invalid worker status: %', p_status;
    END IF;
    
    -- Check visit is not terminal
    SELECT status INTO v_visit_status FROM visits WHERE id = p_visit_id;
    
    IF v_visit_status IN ('Completed', 'Incomplete', 'Aborted') THEN
        RAISE EXCEPTION 'Cannot log status to terminal visit';
    END IF;
    
    -- Insert log (immutable)
    INSERT INTO worker_visit_logs (
        visit_id,
        person_id,
        status,
        latitude,
        longitude,
        device_info
    ) VALUES (
        p_visit_id,
        v_person_id,
        p_status,
        p_latitude,
        p_longitude,
        p_device_info
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_worker_status(UUID, TEXT, NUMERIC, NUMERIC, JSONB) TO authenticated;

-- ============================================================================
-- 6. GET VISIT DETAILS WITH WORKER STATUSES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_visit_details(p_visit_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'visit', jsonb_build_object(
            'id', v.id,
            'job_id', v.job_id,
            'visit_number', v.visit_number,
            'status', v.status,
            'scheduled_start', v.scheduled_start,
            'actual_start', v.actual_start,
            'actual_end', v.actual_end,
            'derived_state', derive_visit_state(v.id)
        ),
        'workers', (
            SELECT jsonb_agg(jsonb_build_object(
                'person_id', wvl.person_id,
                'person_name', p.first_name || ' ' || p.last_name,
                'status', wvl.status,
                'recorded_at', wvl.recorded_at,
                'latitude', wvl.latitude,
                'longitude', wvl.longitude
            ) ORDER BY wvl.recorded_at DESC)
            FROM (
                SELECT DISTINCT ON (person_id) *
                FROM worker_visit_logs
                WHERE visit_id = p_visit_id
                ORDER BY person_id, recorded_at DESC
            ) wvl
            JOIN people p ON p.id = wvl.person_id
        ),
        'status_history', (
            SELECT jsonb_agg(jsonb_build_object(
                'person_id', wvl.person_id,
                'person_name', p.first_name || ' ' || p.last_name,
                'status', wvl.status,
                'recorded_at', wvl.recorded_at
            ) ORDER BY wvl.recorded_at)
            FROM worker_visit_logs wvl
            JOIN people p ON p.id = wvl.person_id
            WHERE wvl.visit_id = p_visit_id
        )
    ) INTO v_result
    FROM visits v
    WHERE v.id = p_visit_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_visit_details(UUID) TO authenticated;
