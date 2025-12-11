-- Migration: Add scheduled_end column to visits table
-- Purpose: Support job work window end times with duration calculation
-- Date: 2024-12-11

-- ============================================================================
-- 1. ADD SCHEDULED_END COLUMN TO VISITS
-- ============================================================================

ALTER TABLE visits ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;

-- ============================================================================
-- 2. ADD DURATION CALCULATION FUNCTION (Business Logic in Database)
-- ============================================================================

-- Function to calculate visit duration in minutes
CREATE OR REPLACE FUNCTION calculate_visit_duration_minutes(
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
)
RETURNS INT AS $$
BEGIN
    IF p_start IS NULL OR p_end IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF p_end <= p_start THEN
        RETURN NULL; -- Invalid: end must be after start
    END IF;
    
    RETURN EXTRACT(EPOCH FROM (p_end - p_start)) / 60;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to format duration as human-readable string (e.g., "2h 30m")
CREATE OR REPLACE FUNCTION format_duration(p_minutes INT)
RETURNS TEXT AS $$
DECLARE
    v_hours INT;
    v_mins INT;
BEGIN
    IF p_minutes IS NULL OR p_minutes <= 0 THEN
        RETURN NULL;
    END IF;
    
    v_hours := p_minutes / 60;
    v_mins := p_minutes % 60;
    
    IF v_hours > 0 AND v_mins > 0 THEN
        RETURN v_hours || 'h ' || v_mins || 'm';
    ELSIF v_hours > 0 THEN
        RETURN v_hours || 'h';
    ELSE
        RETURN v_mins || 'm';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 3. UPDATE CREATE_VISIT RPC TO ACCEPT SCHEDULED_END
-- ============================================================================

-- First, drop the old function signature
DROP FUNCTION IF EXISTS create_visit(UUID, TIMESTAMPTZ);

-- Create new function with scheduled_end parameter
CREATE OR REPLACE FUNCTION create_visit(
    p_job_id UUID,
    p_scheduled_start TIMESTAMPTZ DEFAULT NULL,
    p_scheduled_end TIMESTAMPTZ DEFAULT NULL
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
    
    -- Validate end is after start if both provided
    IF p_scheduled_start IS NOT NULL AND p_scheduled_end IS NOT NULL THEN
        IF p_scheduled_end <= p_scheduled_start THEN
            RAISE EXCEPTION 'End time must be after start time';
        END IF;
    END IF;
    
    -- Get next visit number
    SELECT COALESCE(MAX(visit_number), 0) + 1 INTO v_visit_number
    FROM visits WHERE job_id = p_job_id;
    
    -- Create visit
    INSERT INTO visits (job_id, visit_number, scheduled_start, scheduled_end, status)
    VALUES (p_job_id, v_visit_number, p_scheduled_start, p_scheduled_end, 'Scheduled')
    RETURNING id INTO v_visit_id;
    
    RETURN v_visit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_visit(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- 4. UPDATE GET_VISIT_DETAILS TO INCLUDE SCHEDULED_END AND DURATION
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
            'scheduled_end', v.scheduled_end,
            'duration_minutes', calculate_visit_duration_minutes(v.scheduled_start, v.scheduled_end),
            'duration_formatted', format_duration(calculate_visit_duration_minutes(v.scheduled_start, v.scheduled_end)),
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

-- ============================================================================
-- 5. NOTIFY SCHEMA RELOAD
-- ============================================================================

NOTIFY pgrst, 'reload schema';
