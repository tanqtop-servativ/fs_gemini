-- Migration: Add sort_order to templates and create reorder RPCs
-- Purpose: Enable drag-and-drop reordering

-- 1. Add sort_order columns
ALTER TABLE job_templates ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE service_templates ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE bom_templates ADD COLUMN sort_order INTEGER DEFAULT 0;

-- 2. Create Reorder RPCs

-- Job Templates
CREATE OR REPLACE FUNCTION reorder_job_templates(p_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
    v_idx INTEGER;
BEGIN
    FOR v_idx IN 0 .. array_upper(p_ids, 1) - 1 LOOP
        v_id := p_ids[v_idx + 1];
        UPDATE job_templates 
        SET sort_order = v_idx, updated_at = NOW()
        WHERE id = v_id;
    END LOOP;
    
    RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION reorder_job_templates(UUID[]) TO authenticated;

-- Service Templates
CREATE OR REPLACE FUNCTION reorder_service_templates(p_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
    v_idx INTEGER;
BEGIN
    FOR v_idx IN 0 .. array_upper(p_ids, 1) - 1 LOOP
        v_id := p_ids[v_idx + 1];
        UPDATE service_templates 
        SET sort_order = v_idx, updated_at = NOW()
        WHERE id = v_id;
    END LOOP;
    
    RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION reorder_service_templates(UUID[]) TO authenticated;

-- BOM Templates
CREATE OR REPLACE FUNCTION reorder_bom_templates(p_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
    v_idx INTEGER;
BEGIN
    FOR v_idx IN 0 .. array_upper(p_ids, 1) - 1 LOOP
        v_id := p_ids[v_idx + 1];
        UPDATE bom_templates 
        SET sort_order = v_idx, updated_at = NOW()
        WHERE id = v_id;
    END LOOP;
    
    RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION reorder_bom_templates(UUID[]) TO authenticated;
