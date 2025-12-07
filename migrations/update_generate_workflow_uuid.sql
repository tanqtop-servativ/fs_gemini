-- VERIFIED generate_service_workflow RPC
-- Matches actual schema as of 2025-12-07

-- Tables used:
-- service_opportunities: id(uuid), tenant_id, property_id, service_template_id, status
-- service_workflow_steps: id(uuid), service_template_id, job_template_id, sort_order
-- job_templates: id(uuid), name
-- jobs: id(uuid), tenant_id, service_opportunity_id, property_id, title, description, status, priority
-- job_tasks: id(uuid), job_id, title, is_completed
-- task_templates: id(uuid), job_template_id, title, order_index

DROP FUNCTION IF EXISTS generate_service_workflow(UUID);

CREATE OR REPLACE FUNCTION generate_service_workflow(p_service_opportunity_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_opp RECORD;
    v_step RECORD;
    v_job_id UUID;
    v_created_jobs JSONB := '[]'::jsonb;
    v_job_title TEXT;
    v_step_count INTEGER := 0;
BEGIN
    -- Get Opportunity Details
    SELECT so.*, st.name as template_name
    INTO v_opp 
    FROM service_opportunities so
    LEFT JOIN service_templates st ON st.id = so.service_template_id
    WHERE so.id = p_service_opportunity_id;
    
    IF v_opp IS NULL THEN
        RAISE EXCEPTION 'Service Opportunity % not found', p_service_opportunity_id;
    END IF;

    IF v_opp.service_template_id IS NULL THEN
        RAISE EXCEPTION 'Service Opportunity has no template assigned';
    END IF;

    -- Loop through Workflow Steps for this Template
    FOR v_step IN 
        SELECT 
            sws.id,
            sws.job_template_id,
            sws.sort_order,
            sws.is_optional,
            jt.name as job_template_name
        FROM service_workflow_steps sws
        LEFT JOIN job_templates jt ON jt.id = sws.job_template_id
        WHERE sws.service_template_id = v_opp.service_template_id
        ORDER BY sws.sort_order ASC
    LOOP
        v_step_count := v_step_count + 1;
        
        -- Job title from job template name, or fallback
        v_job_title := COALESCE(v_step.job_template_name, 'Step ' || v_step_count);

        -- Create Job
        INSERT INTO jobs (
            id,
            tenant_id,
            service_opportunity_id,
            property_id,
            title,
            description,
            status,
            priority,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            v_opp.tenant_id,
            v_opp.id,
            v_opp.property_id,
            v_job_title,
            '',
            'Pending',
            'normal',
            NOW(),
            NOW()
        ) RETURNING id INTO v_job_id;
        
        -- Add to result
        v_created_jobs := v_created_jobs || jsonb_build_object(
            'job_id', v_job_id,
            'title', v_job_title,
            'sort_order', v_step.sort_order
        );

        -- Create Job Tasks from task_templates if job_template exists
        IF v_step.job_template_id IS NOT NULL THEN
            INSERT INTO job_tasks (id, job_id, title, is_completed, created_at)
            SELECT 
                gen_random_uuid(),
                v_job_id,
                tt.title,
                FALSE,
                NOW()
            FROM task_templates tt
            WHERE tt.job_template_id = v_step.job_template_id
            ORDER BY tt.order_index;
        END IF;

    END LOOP;

    -- Update opportunity status if jobs were created
    IF v_step_count > 0 THEN
        UPDATE service_opportunities 
        SET status = 'In Progress', updated_at = NOW()
        WHERE id = p_service_opportunity_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'jobs_created', v_step_count,
        'jobs', v_created_jobs
    );
END;
$$;

GRANT EXECUTE ON FUNCTION generate_service_workflow(UUID) TO authenticated;
