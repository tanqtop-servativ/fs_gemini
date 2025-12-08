-- Migration: Job Disposition Function
-- Purpose: Immutable cancellation/deferral records
-- Date: 2024-12-08

-- ============================================================================
-- DISPOSE JOB FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION dispose_job(
    p_job_id UUID,
    p_disposition_type TEXT,  -- 'cancelled', 'not_required', 'deferred'
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_disposition_id UUID;
    v_person_id UUID;
    v_current_status TEXT;
BEGIN
    -- Get person from auth context
    SELECT p.id INTO v_person_id
    FROM people p
    WHERE p.user_id = auth.uid();
    
    IF v_person_id IS NULL THEN
        RAISE EXCEPTION 'User not linked to person record';
    END IF;
    
    -- Validate disposition type
    IF p_disposition_type NOT IN ('cancelled', 'not_required', 'deferred') THEN
        RAISE EXCEPTION 'Invalid disposition type: %', p_disposition_type;
    END IF;
    
    -- Check job exists and is not already complete
    SELECT status INTO v_current_status FROM jobs WHERE id = p_job_id;
    
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;
    
    IF v_current_status = 'Complete' THEN
        RAISE EXCEPTION 'Cannot dispose a completed job';
    END IF;
    
    -- Validate reason length
    IF LENGTH(TRIM(p_reason)) < 10 THEN
        RAISE EXCEPTION 'Reason must be at least 10 characters';
    END IF;
    
    -- Create disposition record (immutable)
    INSERT INTO job_dispositions (
        job_id,
        disposition_type,
        reason,
        disposed_by
    ) VALUES (
        p_job_id,
        p_disposition_type,
        p_reason,
        v_person_id
    )
    RETURNING id INTO v_disposition_id;
    
    -- Update job status
    UPDATE jobs 
    SET status = CASE p_disposition_type
            WHEN 'cancelled' THEN 'Cancelled'
            WHEN 'not_required' THEN 'Not Required'
            WHEN 'deferred' THEN 'Deferred'
        END,
        updated_at = now()
    WHERE id = p_job_id;
    
    -- Abort any active visits
    UPDATE visits
    SET status = 'Aborted', actual_end = now()
    WHERE job_id = p_job_id AND status NOT IN ('Completed', 'Incomplete', 'Aborted');
    
    RETURN v_disposition_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION dispose_job(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- GET JOB DISPOSITIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_job_dispositions(p_job_id UUID)
RETURNS TABLE (
    id UUID,
    disposition_type TEXT,
    reason TEXT,
    disposed_by UUID,
    disposed_by_name TEXT,
    disposed_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        jd.id,
        jd.disposition_type,
        jd.reason,
        jd.disposed_by,
        p.first_name || ' ' || p.last_name AS disposed_by_name,
        jd.disposed_at
    FROM job_dispositions jd
    JOIN people p ON p.id = jd.disposed_by
    WHERE jd.job_id = p_job_id
    ORDER BY jd.disposed_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_job_dispositions(UUID) TO authenticated;
