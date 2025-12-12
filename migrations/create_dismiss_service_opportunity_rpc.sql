-- Migration: Create dismiss_service_opportunity RPC
-- Purpose: Atomically dismiss an opportunity and delete its jobs

DROP FUNCTION IF EXISTS dismiss_service_opportunity(UUID, TEXT);

CREATE OR REPLACE FUNCTION dismiss_service_opportunity(
    p_service_opportunity_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_person_id UUID;
    v_jobs_deleted INT;
BEGIN
    -- Get person from auth context (optional logging or checks)
    SELECT p.id INTO v_person_id
    FROM people p
    WHERE p.user_id = auth.uid();

    -- Update Opportunity Status
    UPDATE service_opportunities 
    SET 
        status = 'Dismissed', 
        dismissal_reason = p_reason, 
        updated_at = NOW()
    WHERE id = p_service_opportunity_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Service Opportunity not found');
    END IF;

    -- Soft Delete Associated Jobs
    WITH deleted_jobs AS (
        UPDATE jobs
        SET 
            deleted_at = NOW(),
            updated_at = NOW()
        WHERE service_opportunity_id = p_service_opportunity_id
        AND deleted_at IS NULL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_jobs_deleted FROM deleted_jobs;

    -- Optional: Log amendment/audit?
    -- For now just return success

    RETURN jsonb_build_object(
        'success', TRUE,
        'jobs_deleted', v_jobs_deleted
    );
END;
$$;

GRANT EXECUTE ON FUNCTION dismiss_service_opportunity(UUID, TEXT) TO authenticated;
