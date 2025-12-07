
-- Drop previous definitions (v2)
DROP FUNCTION IF EXISTS create_job_template(text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS update_job_template(uuid, text, text, text, text, jsonb);

-- Create secure create_job_template (v3: with checklists)
CREATE OR REPLACE FUNCTION create_job_template(
    p_name text,
    p_description text,
    p_name_es text,
    p_description_es text,
    p_tasks jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job_id uuid;
    v_task_id uuid;
    v_task jsonb;
    v_checklist jsonb;
    v_item jsonb;
    v_sort_order integer := 0;
    v_check_order integer := 0;
    v_tenant_id uuid;
BEGIN
    -- Derive tenant_id from current user
    SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = auth.uid();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'User not associated with a tenant';
    END IF;

    INSERT INTO job_templates (name, description, name_es, description_es, tenant_id)
    VALUES (p_name, p_description, p_name_es, p_description_es, v_tenant_id)
    RETURNING id INTO v_job_id;

    IF p_tasks IS NOT NULL THEN
        FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
        LOOP
            INSERT INTO job_template_tasks (
                job_template_id, title, description, title_es, description_es, is_required, require_photo, sort_order
            )
            VALUES (
                v_job_id,
                v_task->>'title',
                v_task->>'description',
                v_task->>'title_es',
                v_task->>'description_es',
                COALESCE((v_task->>'is_required')::boolean, false),
                COALESCE((v_task->>'require_photo')::boolean, false),
                v_sort_order
            )
            RETURNING id INTO v_task_id;
            
            -- Handle Checklist Items
            v_checklist := v_task->'checklist';
            IF v_checklist IS NOT NULL AND jsonb_typeof(v_checklist) = 'array' THEN
                v_check_order := 0;
                FOR v_item IN SELECT * FROM jsonb_array_elements(v_checklist)
                LOOP
                    INSERT INTO job_template_checklist_items (
                        job_template_task_id, tenant_id, description, description_es, item_type, sort_order
                    )
                    VALUES (
                        v_task_id,
                        v_tenant_id,
                        v_item->>'description',
                        v_item->>'description_es',
                        COALESCE(v_item->>'item_type', 'simple'),
                        v_check_order
                    );
                    v_check_order := v_check_order + 1;
                END LOOP;
            END IF;

            v_sort_order := v_sort_order + 1;
        END LOOP;
    END IF;

    RETURN v_job_id;
END;
$$;

-- Create secure update_job_template (v3: with checklists)
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
SECURITY DEFINER
AS $$
DECLARE
    v_task_id uuid;
    v_task jsonb;
    v_checklist jsonb;
    v_item jsonb;
    v_sort_order integer := 0;
    v_check_order integer := 0;
    v_tenant_id uuid;
BEGIN
    -- Ensure user owns this template (or is in same tenant)
    SELECT tenant_id INTO v_tenant_id FROM job_templates WHERE id = p_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Template not found';
    END IF;

    -- Update Header
    UPDATE job_templates 
    SET name = p_name,
        description = p_description,
        name_es = p_name_es,
        description_es = p_description_es,
        updated_at = now()
    WHERE id = p_id;

    -- Replace Tasks (Cascade deletes checklist items due to FK on job_template_checklist_items)
    DELETE FROM job_template_tasks WHERE job_template_id = p_id;

    IF p_tasks IS NOT NULL THEN
        FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
        LOOP
            INSERT INTO job_template_tasks (
                job_template_id, title, description, title_es, description_es, is_required, require_photo, sort_order
            )
            VALUES (
                p_id,
                v_task->>'title',
                v_task->>'description',
                v_task->>'title_es',
                v_task->>'description_es',
                COALESCE((v_task->>'is_required')::boolean, false),
                COALESCE((v_task->>'require_photo')::boolean, false),
                v_sort_order
            )
            RETURNING id INTO v_task_id;

            -- Handle Checklist Items
            v_checklist := v_task->'checklist';
            IF v_checklist IS NOT NULL AND jsonb_typeof(v_checklist) = 'array' THEN
                v_check_order := 0;
                FOR v_item IN SELECT * FROM jsonb_array_elements(v_checklist)
                LOOP
                    INSERT INTO job_template_checklist_items (
                        job_template_task_id, tenant_id, description, description_es, item_type, sort_order
                    )
                    VALUES (
                        v_task_id,
                        v_tenant_id,
                        v_item->>'description',
                        v_item->>'description_es',
                        COALESCE(v_item->>'item_type', 'simple'),
                        v_check_order
                    );
                    v_check_order := v_check_order + 1;
                END LOOP;
            END IF;

            v_sort_order := v_sort_order + 1;
        END LOOP;
    END IF;
END;
$$;
