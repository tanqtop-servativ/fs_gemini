import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def update_rpc():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Updating generate_service_workflow RPC (with Tasks)...")

        cur.execute("DROP FUNCTION IF EXISTS generate_service_workflow(bigint);")

        cur.execute("""
            CREATE OR REPLACE FUNCTION generate_service_workflow(p_service_opportunity_id BIGINT)
            RETURNS JSONB
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_opp RECORD;
                v_step RECORD;
                v_job_id BIGINT;
                v_step_job_map JSONB := '{}'::jsonb; -- Map step_id -> job_id
                v_parent_job_id BIGINT;
                v_status TEXT;
                v_metadata JSONB;
                v_created_jobs JSONB := '[]'::jsonb;
            BEGIN
                RAISE NOTICE 'Running generate_service_workflow v2.1 (Tasks) for Opp %', p_service_opportunity_id;
                
                -- 1. Get Opportunity Details
                SELECT * INTO v_opp FROM service_opportunities WHERE id = p_service_opportunity_id;
                
                IF v_opp IS NULL THEN
                    RAISE EXCEPTION 'Service Opportunity % not found', p_service_opportunity_id;
                END IF;

                -- 2. Loop through Workflow Steps for this Template
                FOR v_step IN 
                    SELECT * FROM service_workflow_steps 
                    WHERE service_template_id = v_opp.service_template_id 
                    ORDER BY order_index ASC
                LOOP
                    -- Resolve Parent Job (Dependency)
                    v_parent_job_id := NULL;
                    v_status := 'Pending'; -- Default
                    
                    IF v_step.depends_on_step_id IS NOT NULL THEN
                        v_parent_job_id := (v_step_job_map ->> v_step.depends_on_step_id::text)::BIGINT;
                        IF v_parent_job_id IS NOT NULL THEN
                            v_status := 'Blocked'; -- Blocked if parent exists
                        END IF;
                    ELSE
                        v_status := 'Ready'; -- No dependency, ready to start
                    END IF;

                    -- Metadata
                    v_metadata := jsonb_build_object(
                        'step_name', v_step.step_name,
                        'step_id', v_step.id,
                        'parent_job_id', v_parent_job_id
                    );

                    -- Create Job
                    INSERT INTO jobs (
                        tenant_id,
                        service_opportunity_id,
                        type,
                        status,
                        metadata,
                        dependency_job_id,
                        created_at,
                        updated_at
                    ) VALUES (
                        v_opp.tenant_id,
                        v_opp.id,
                        v_step.job_type,
                        v_status,
                        v_metadata,
                        v_parent_job_id,
                        NOW(),
                        NOW()
                    ) RETURNING id INTO v_job_id;

                    -- Store in map
                    v_step_job_map := v_step_job_map || jsonb_build_object(v_step.id::text, v_job_id);
                    
                    -- Add to result
                    v_created_jobs := v_created_jobs || jsonb_build_object(
                        'step', v_step.step_name,
                        'type', v_step.job_type,
                        'job_id', v_job_id
                    );

                    -- *** NEW: Create Job Tasks ***
                    -- If this step is linked to a Job Template, copy its tasks
                    IF v_step.job_template_id IS NOT NULL THEN
                        INSERT INTO job_tasks (
                            job_id,
                            task_template_id,
                            title,
                            status,
                            data
                        )
                        SELECT 
                            v_job_id,
                            id,
                            title,
                            'Pending',
                            jsonb_build_object('input_type', input_type)
                        FROM task_templates
                        WHERE job_template_id = v_step.job_template_id;
                        
                        RAISE NOTICE 'Created tasks for Job % (Template %)', v_job_id, v_step.job_template_id;
                    END IF;

                    -- *** NEW: Create Job Inputs ***
                    IF v_step.job_template_id IS NOT NULL THEN
                        INSERT INTO job_inputs (
                            job_id,
                            input_definition_id,
                            tenant_id,
                            value
                        )
                        SELECT 
                            v_job_id,
                            id,
                            v_opp.tenant_id,
                            NULL
                        FROM job_template_inputs
                        WHERE job_template_id = v_step.job_template_id;
                        
                        RAISE NOTICE 'Created inputs for Job %', v_job_id;
                    END IF;

                END LOOP;

                RETURN v_created_jobs;
            END;
            $$;
        """)
        
        conn.commit()
        print("✅ RPC updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    update_rpc()
