-- Migration: Job/Visit State Derivation Logic
-- Purpose: Auto-derive visit state from worker statuses
-- Date: 2024-12-08

-- ============================================================================
-- DERIVE VISIT STATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION derive_visit_state(p_visit_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_total_active INT;
    v_finished INT;
    v_paused INT;
    v_started INT;
    v_en_route INT;
    v_has_workers BOOLEAN;
BEGIN
    -- Get latest status per worker (excluding No-show from active counts)
    WITH latest_statuses AS (
        SELECT DISTINCT ON (person_id) 
            person_id, 
            status
        FROM worker_visit_logs
        WHERE visit_id = p_visit_id
        ORDER BY person_id, recorded_at DESC
    )
    SELECT 
        COUNT(*) FILTER (WHERE status != 'No-show'),
        COUNT(*) FILTER (WHERE status = 'Finished'),
        COUNT(*) FILTER (WHERE status = 'Paused'),
        COUNT(*) FILTER (WHERE status IN ('Started', 'Paused', 'Finished')),
        COUNT(*) FILTER (WHERE status = 'On My Way'),
        COUNT(*) > 0
    INTO 
        v_total_active, v_finished, v_paused, v_started, v_en_route, v_has_workers
    FROM latest_statuses;
    
    -- No workers at all
    IF NOT v_has_workers THEN
        RETURN 'Unassigned';
    END IF;
    
    -- All workers are No-show
    IF v_total_active = 0 THEN
        RETURN 'Abandoned';
    END IF;
    
    -- All active workers Finished
    IF v_finished = v_total_active THEN
        RETURN 'Finished';
    END IF;
    
    -- Any worker has Started/Paused/Finished
    IF v_started > 0 THEN
        -- All active workers Paused
        IF v_paused = v_total_active THEN
            RETURN 'Paused';
        END IF;
        RETURN 'Started';
    END IF;
    
    -- Any worker On My Way
    IF v_en_route > 0 THEN
        RETURN 'En Route';
    END IF;
    
    -- Default
    RETURN 'Assigned';
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TRIGGER TO UPDATE VISIT STATUS ON WORKER LOG INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_visit_derived_state()
RETURNS TRIGGER AS $$
DECLARE
    v_new_state TEXT;
    v_current_status TEXT;
BEGIN
    -- Get current visit status
    SELECT status INTO v_current_status 
    FROM visits WHERE id = NEW.visit_id;
    
    -- Don't update terminal visits
    IF v_current_status IN ('Completed', 'Incomplete', 'Aborted') THEN
        RETURN NEW;
    END IF;
    
    -- Derive new state
    v_new_state := derive_visit_state(NEW.visit_id);
    
    -- Map derived state to visit status
    -- Started, Paused, En Route all map to 'In Progress'
    IF v_new_state IN ('Started', 'Paused', 'En Route') THEN
        UPDATE visits 
        SET status = 'In Progress', 
            actual_start = COALESCE(actual_start, NEW.recorded_at)
        WHERE id = NEW.visit_id 
          AND status = 'Scheduled';
    END IF;
    
    -- Note: 'Finished' does NOT auto-set visit to 'Completed'
    -- Completion requires explicit CompletionArtifact submission
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_visit_state ON worker_visit_logs;
CREATE TRIGGER trg_update_visit_state
    AFTER INSERT ON worker_visit_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_visit_derived_state();

-- ============================================================================
-- HELPER: GET DERIVED STATE FOR A JOB (across all visits)
-- ============================================================================

CREATE OR REPLACE FUNCTION derive_job_state(p_job_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_latest_visit_id UUID;
    v_visit_status TEXT;
    v_derived_state TEXT;
BEGIN
    -- Get the latest non-terminal visit for this job
    SELECT id, status INTO v_latest_visit_id, v_visit_status
    FROM visits
    WHERE job_id = p_job_id
    ORDER BY visit_number DESC
    LIMIT 1;
    
    -- No visits yet
    IF v_latest_visit_id IS NULL THEN
        RETURN 'Pending';
    END IF;
    
    -- If latest visit is terminal, job state depends on that
    IF v_visit_status = 'Completed' THEN
        RETURN 'Finished';  -- But not Complete until CompletionArtifact
    ELSIF v_visit_status IN ('Incomplete', 'Aborted') THEN
        RETURN 'Needs Retry';
    END IF;
    
    -- Otherwise derive from worker statuses
    v_derived_state := derive_visit_state(v_latest_visit_id);
    RETURN v_derived_state;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION derive_visit_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION derive_job_state(UUID) TO authenticated;
