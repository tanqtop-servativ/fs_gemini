
-- Drop existing functions to allow return type change
-- We drop generic to catch variants if possible, but specific signature is safer for overloading.
-- Bashing "DROP FUNCTION IF EXISTS name" overloads requires specific args.

DROP FUNCTION IF EXISTS create_job_template(text, text, text, text, jsonb, uuid);
DROP FUNCTION IF EXISTS update_job_template(uuid, text, text, text, text, jsonb);

-- Create or Replace create_job_template RPC
CREATE OR REPLACE FUNCTION create_job_template(
    p_name text,
    p_description text,
    p_name_es text,
    p_description_es text,
    p_tasks jsonb,
    p_tenant_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_job_id uuid;
    v_task jsonb;
    v_sort_order integer := 0;
BEGIN
    INSERT INTO job_templates (name, description, name_es, description_es, tenant_id)
    VALUES (p_name, p_description, p_name_es, p_description_es, p_tenant_id)
    RETURNING id INTO v_job_id;

    IF p_tasks IS NOT NULL THEN
        FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
        LOOP
            INSERT INTO job_template_tasks (
                job_template_id, tenant_id, title, description, title_es, description_es, is_required, require_photo, sort_order
            )
            VALUES (
                v_job_id,
                p_tenant_id,
                v_task->>'title',
                v_task->>'description',
                v_task->>'title_es',
                v_task->>'description_es',
                COALESCE((v_task->>'is_required')::boolean, false),
                COALESCE((v_task->>'require_photo')::boolean, false),
                v_sort_order
            );
            v_sort_order := v_sort_order + 1;
        END LOOP;
    END IF;

    RETURN v_job_id;
END;
$$;

-- Create or Replace update_job_template RPC
CREATE OR REPLACE FUNCTION update_job_template(
    p_id uuid,
    p_name text,
    p_description text,
    p_name_es text,
    p_description_es text,
    p_tasks jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_task jsonb;
    v_sort_order integer := 0;
    v_tenant_id uuid;
BEGIN
    -- Get tenant_id from existing record
    SELECT tenant_id INTO v_tenant_id FROM job_templates WHERE id = p_id;
    
    -- Update Header
    UPDATE job_templates 
    SET name = p_name,
        description = p_description,
        name_es = p_name_es,
        description_es = p_description_es,
        updated_at = now()
    WHERE id = p_id;

    -- Replace Tasks
    DELETE FROM job_template_tasks WHERE job_template_id = p_id;

    IF p_tasks IS NOT NULL THEN
        FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
        LOOP
            INSERT INTO job_template_tasks (
                job_template_id, tenant_id, title, description, title_es, description_es, is_required, require_photo, sort_order
            )
            VALUES (
                p_id,
                v_tenant_id,
                v_task->>'title',
                v_task->>'description',
                v_task->>'title_es',
                v_task->>'description_es',
                COALESCE((v_task->>'is_required')::boolean, false),
                COALESCE((v_task->>'require_photo')::boolean, false),
                v_sort_order
            );
            v_sort_order := v_sort_order + 1;
        END LOOP;
    END IF;
END;
$$;
