import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def update_rpc():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Updating generate_service_workflow RPC (v2)...")

        cur.execute("DROP FUNCTION IF EXISTS generate_service_workflow(bigint);")
        cur.execute("DROP FUNCTION IF EXISTS generate_service_workflow(integer);")
        cur.execute("DROP FUNCTION IF EXISTS generate_service_workflow(integer, integer);")

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
                RAISE NOTICE 'Running generate_service_workflow v2 for Opp %', p_service_opportunity_id;
                
                -- 1. Get Opportunity Details
                SELECT * INTO v_opp FROM service_opportunities WHERE id = p_service_opportunity_id;
                
                IF v_opp.service_template_id IS NULL THEN
                    -- Fallback for old data or if not set (could raise error or handle gracefully)
                    -- For v2, let's assume we need a service_template_id.
                    RAISE EXCEPTION 'Service Opportunity % has no service_template_id', p_service_opportunity_id;
                END IF;

                -- 2. Iterate through Steps (Ordered by dependency/index)
                -- We use a recursive CTE or just order by order_index for simplicity if we assume order_index is correct.
                -- Let's rely on order_index for now, but also handle dependencies.
                FOR v_step IN 
                    SELECT * FROM service_workflow_steps 
                    WHERE service_template_id = v_opp.service_template_id 
                    ORDER BY order_index ASC
                LOOP
                    -- Determine Status
                    v_status := 'Ready';
                    v_parent_job_id := NULL;
                    
                    IF v_step.depends_on_step_id IS NOT NULL THEN
                        -- Check if parent job exists in our map
                        IF v_step_job_map ? v_step.depends_on_step_id::text THEN
                            v_parent_job_id := (v_step_job_map ->> v_step.depends_on_step_id::text)::BIGINT;
                            -- If dependent, maybe set to 'Blocked'? 
                            -- For now, let's set to 'Pending' or 'Blocked'. 
                            -- User wanted "Ready" for immediate scheduling, but strictly speaking, if it depends on something, it might be blocked.
                            -- However, for "Kitting -> Field", we allowed Field to be Ready.
                            -- Let's stick to 'Ready' for Field jobs so they can be scheduled, but maybe 'Pending' for others?
                            -- Let's default to 'Ready' as per previous instruction "ensure all jobs are immediately schedulable".
                            v_status := 'Ready';
                        ELSE
                            RAISE WARNING 'Step % depends on % which was not found/processed yet.', v_step.id, v_step.depends_on_step_id;
                        END IF;
                    END IF;

                    -- Prepare Metadata
                    v_metadata := jsonb_build_object(
                        'step_id', v_step.id,
                        'step_name', v_step.step_name,
                        'parent_job_id', v_parent_job_id,
                        'required_inputs', v_step.required_inputs
                    );

                    -- Create Job
                    INSERT INTO jobs (
                        tenant_id,
                        service_opportunity_id,
                        type,
                        status,
                        metadata
                    ) VALUES (
                        v_opp.tenant_id,
                        v_opp.id,
                        v_step.job_type,
                        v_status,
                        v_metadata
                    ) RETURNING id INTO v_job_id;

                    -- Update Map
                    v_step_job_map := v_step_job_map || jsonb_build_object(v_step.id::text, v_job_id);
                    
                    -- Add to result
                    v_created_jobs := v_created_jobs || jsonb_build_object('job_id', v_job_id, 'type', v_step.job_type, 'step', v_step.step_name);

                END LOOP;

                -- Update Opportunity Status
                UPDATE service_opportunities SET status = 'In Progress' WHERE id = p_service_opportunity_id;

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
