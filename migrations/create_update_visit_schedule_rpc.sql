-- Migration: Create update_visit_schedule RPC
-- Purpose: Allow rescheduling of existing visits

CREATE OR REPLACE FUNCTION update_visit_schedule(
    p_visit_id UUID,
    p_scheduled_start TIMESTAMPTZ,
    p_scheduled_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_updated_id UUID;
BEGIN
    UPDATE visits
    SET 
        scheduled_start = p_scheduled_start,
        scheduled_end = p_scheduled_end,
        updated_at = NOW()
    WHERE id = p_visit_id
    RETURNING id INTO v_updated_id;
    
    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Visit not found');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'visit_id', v_updated_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_visit_schedule(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
