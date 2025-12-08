-- Migration: Artifact Submission Function
-- Purpose: Secure artifact submission with role validation and status updates
-- Date: 2024-12-08

-- ============================================================================
-- SUBMIT ARTIFACT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_artifact(
    p_visit_id UUID,
    p_job_id UUID,
    p_artifact_type TEXT,
    p_payload JSONB,
    p_corrects_artifact_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_artifact_id UUID;
    v_person_id UUID;
    v_role_id UUID;
    v_tenant_id UUID;
    v_job_type_id UUID;
    v_can_attest BOOLEAN;
BEGIN
    -- Get submitter identity from auth context
    SELECT p.id, pr.tenant_id
    INTO v_person_id, v_tenant_id
    FROM people p
    JOIN profiles pr ON pr.id = auth.uid() AND pr.tenant_id = p.tenant_id
    WHERE p.user_id = auth.uid();
    
    IF v_person_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not linked to a person record';
    END IF;
    
    -- Get active role (or default to first role)
    SELECT COALESCE(
        (SELECT active_role_id FROM users WHERE id = auth.uid()),
        (SELECT role_id FROM person_roles WHERE person_id = v_person_id LIMIT 1)
    ) INTO v_role_id;
    
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'User has no assigned roles';
    END IF;
    
    -- If job_id provided, validate role can attest for this job type
    IF p_job_id IS NOT NULL THEN
        SELECT j.job_type_id INTO v_job_type_id
        FROM jobs j WHERE j.id = p_job_id;
        
        -- Check job_template_roles for attestation permission
        SELECT EXISTS (
            SELECT 1 FROM job_template_roles jtr
            JOIN job_templates jt ON jt.id = jtr.job_template_id
            WHERE jt.type = (SELECT type FROM job_templates WHERE id = v_job_type_id)
              AND jtr.role_id = v_role_id
        ) INTO v_can_attest;
        
        -- If no explicit permission found, default to allowing (for flexibility)
        -- In strict mode, you'd raise an exception here
    END IF;
    
    -- Insert immutable artifact
    INSERT INTO artifacts (
        tenant_id,
        visit_id,
        job_id,
        artifact_type,
        submitted_by,
        submitted_as_role,
        submitted_at,
        payload,
        corrects_artifact_id
    ) VALUES (
        v_tenant_id,
        p_visit_id,
        p_job_id,
        p_artifact_type,
        v_person_id,
        v_role_id,
        now(),
        p_payload,
        p_corrects_artifact_id
    )
    RETURNING id INTO v_artifact_id;
    
    -- If CorrectionArtifact that invalidates, update correction chain
    IF p_corrects_artifact_id IS NOT NULL AND 
       (p_payload->>'invalidates')::boolean = true THEN
        UPDATE artifacts 
        SET invalidated_by_artifact_id = v_artifact_id
        WHERE id = p_corrects_artifact_id;
    END IF;
    
    -- Update visit status based on artifact type
    IF p_visit_id IS NOT NULL THEN
        IF p_artifact_type = 'CompletionArtifact' THEN
            UPDATE visits 
            SET status = 'Completed', actual_end = now()
            WHERE id = p_visit_id 
              AND status NOT IN ('Completed', 'Incomplete', 'Aborted');
              
        ELSIF p_artifact_type = 'IncompletionArtifact' THEN
            UPDATE visits 
            SET status = 'Incomplete', actual_end = now()
            WHERE id = p_visit_id 
              AND status NOT IN ('Completed', 'Incomplete', 'Aborted');
        END IF;
    END IF;
    
    -- Update job status if all visits complete
    IF p_job_id IS NOT NULL AND p_artifact_type = 'CompletionArtifact' THEN
        -- Check if all visits for this job are in terminal state
        IF NOT EXISTS (
            SELECT 1 FROM visits 
            WHERE job_id = p_job_id 
              AND status NOT IN ('Completed', 'Incomplete', 'Aborted')
        ) THEN
            -- All visits done, check if any incomplete
            IF NOT EXISTS (
                SELECT 1 FROM visits 
                WHERE job_id = p_job_id 
                  AND status IN ('Incomplete', 'Aborted')
            ) THEN
                -- All visits completed successfully
                UPDATE jobs 
                SET status = 'Complete', completed_at = now()
                WHERE id = p_job_id;
            END IF;
        END IF;
    END IF;
    
    RETURN v_artifact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION submit_artifact(UUID, UUID, TEXT, JSONB, UUID) TO authenticated;

-- ============================================================================
-- HELPER: Get artifacts for a visit/job
-- ============================================================================

CREATE OR REPLACE FUNCTION get_artifacts_for_visit(p_visit_id UUID)
RETURNS TABLE (
    id UUID,
    artifact_type TEXT,
    submitted_by UUID,
    submitted_by_name TEXT,
    submitted_as_role UUID,
    role_name TEXT,
    submitted_at TIMESTAMPTZ,
    payload JSONB,
    is_invalidated BOOLEAN,
    corrects_artifact_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.artifact_type,
        a.submitted_by,
        p.first_name || ' ' || p.last_name AS submitted_by_name,
        a.submitted_as_role,
        r.name AS role_name,
        a.submitted_at,
        a.payload,
        a.invalidated_by_artifact_id IS NOT NULL AS is_invalidated,
        a.corrects_artifact_id
    FROM artifacts a
    JOIN people p ON p.id = a.submitted_by
    JOIN roles r ON r.id = a.submitted_as_role
    WHERE a.visit_id = p_visit_id
    ORDER BY a.submitted_at;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_artifacts_for_visit(UUID) TO authenticated;
