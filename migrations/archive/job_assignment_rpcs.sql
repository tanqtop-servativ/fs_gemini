-- RPCs for Job Assignment Management

-- 1. Assign a person to a job
CREATE OR REPLACE FUNCTION assign_person_to_job(
    p_job_id UUID,
    p_person_id UUID,
    p_role_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_assignment_id UUID;
    v_tenant_id UUID;
BEGIN
    -- Get tenant from job
    SELECT tenant_id INTO v_tenant_id FROM jobs WHERE id = p_job_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Job not found';
    END IF;
    
    -- Verify person belongs to same tenant
    IF NOT EXISTS (SELECT 1 FROM people WHERE id = p_person_id AND tenant_id = v_tenant_id) THEN
        RAISE EXCEPTION 'Person not found or not in same tenant';
    END IF;
    
    -- Create assignment
    INSERT INTO job_assignments (job_id, person_id, role_id, status)
    VALUES (p_job_id, p_person_id, p_role_id, 'assigned')
    ON CONFLICT (job_id, person_id) DO UPDATE SET
        status = 'assigned',
        updated_at = NOW()
    RETURNING id INTO v_assignment_id;
    
    RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update my assignment status (for workers)
CREATE OR REPLACE FUNCTION update_my_assignment_status(
    p_job_id UUID,
    p_new_status TEXT
)
RETURNS VOID AS $$
DECLARE
    v_person_id UUID;
    v_current_status TEXT;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Get person_id from auth
    SELECT id INTO v_person_id FROM people 
    WHERE user_id = auth.uid() 
    LIMIT 1;
    
    IF v_person_id IS NULL THEN
        RAISE EXCEPTION 'Person record not found for current user';
    END IF;
    
    -- Get current status
    SELECT status INTO v_current_status 
    FROM job_assignments 
    WHERE job_id = p_job_id AND person_id = v_person_id;
    
    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'You are not assigned to this job';
    END IF;
    
    -- Validate status transition
    IF p_new_status NOT IN ('en_route', 'started', 'paused', 'finished') THEN
        RAISE EXCEPTION 'Invalid status for self-update: %', p_new_status;
    END IF;
    
    -- Handle pause accumulation
    IF v_current_status = 'paused' AND p_new_status IN ('started', 'finished') THEN
        -- Add pause duration to cumulative
        UPDATE job_assignments SET
            cumulative_paused_seconds = cumulative_paused_seconds + 
                EXTRACT(EPOCH FROM (v_now - last_paused_at))::INTEGER,
            last_paused_at = NULL,
            status = p_new_status,
            started_at = CASE WHEN p_new_status = 'started' AND started_at IS NULL THEN v_now ELSE started_at END,
            finished_at = CASE WHEN p_new_status = 'finished' THEN v_now ELSE finished_at END,
            updated_at = v_now
        WHERE job_id = p_job_id AND person_id = v_person_id;
    ELSE
        -- Normal update
        UPDATE job_assignments SET
            status = p_new_status,
            en_route_at = CASE WHEN p_new_status = 'en_route' AND en_route_at IS NULL THEN v_now ELSE en_route_at END,
            started_at = CASE WHEN p_new_status = 'started' AND started_at IS NULL THEN v_now ELSE started_at END,
            finished_at = CASE WHEN p_new_status = 'finished' THEN v_now ELSE finished_at END,
            last_paused_at = CASE WHEN p_new_status = 'paused' THEN v_now ELSE last_paused_at END,
            updated_at = v_now
        WHERE job_id = p_job_id AND person_id = v_person_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Remove an assignment (manager action)
CREATE OR REPLACE FUNCTION remove_assignment(
    p_assignment_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE job_assignments SET 
        status = 'removed',
        updated_at = NOW()
    WHERE id = p_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Mark no-show (manager action)
CREATE OR REPLACE FUNCTION mark_assignment_no_show(
    p_assignment_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE job_assignments SET 
        status = 'no_show',
        updated_at = NOW()
    WHERE id = p_assignment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Get job with assignments (for detail view)
CREATE OR REPLACE FUNCTION get_job_with_assignments(p_job_id UUID)
RETURNS TABLE (
    job_id UUID,
    job_title TEXT,
    job_status TEXT,
    computed_status TEXT,
    assignment_id UUID,
    person_id UUID,
    person_name TEXT,
    assignment_status TEXT,
    en_route_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    cumulative_paused_seconds INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        j.id AS job_id,
        j.title AS job_title,
        j.status AS job_status,
        j.computed_status,
        ja.id AS assignment_id,
        ja.person_id,
        (p.first_name || ' ' || p.last_name) AS person_name,
        ja.status AS assignment_status,
        ja.en_route_at,
        ja.started_at,
        ja.finished_at,
        ja.cumulative_paused_seconds
    FROM jobs j
    LEFT JOIN job_assignments ja ON j.id = ja.job_id AND ja.status NOT IN ('removed')
    LEFT JOIN people p ON ja.person_id = p.id
    WHERE j.id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION assign_person_to_job TO authenticated;
GRANT EXECUTE ON FUNCTION update_my_assignment_status TO authenticated;
GRANT EXECUTE ON FUNCTION remove_assignment TO authenticated;
GRANT EXECUTE ON FUNCTION mark_assignment_no_show TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_with_assignments TO authenticated;
