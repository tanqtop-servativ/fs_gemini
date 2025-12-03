import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_rpc():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Creating generate_service_workflow RPC...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION generate_service_workflow(
                p_service_opportunity_id INT,
                p_assigned_to INT DEFAULT NULL
            )
            RETURNS JSONB AS $$
            DECLARE
                v_tenant_id INT;
                v_job_template_id INT;
                v_bom_id INT;
                v_kitting_job_id INT;
                v_field_job_id INT;
                v_template_name TEXT;
            BEGIN
                -- 1. Get Opportunity Details
                SELECT tenant_id, job_template_id 
                INTO v_tenant_id, v_job_template_id
                FROM service_opportunities
                WHERE id = p_service_opportunity_id;
                
                IF v_tenant_id IS NULL THEN
                    RETURN jsonb_build_object('success', false, 'error', 'Opportunity not found');
                END IF;

                -- 2. Get Template Details (Check for BOM)
                SELECT bom_id, name
                INTO v_bom_id, v_template_name
                FROM job_templates
                WHERE id = v_job_template_id;

                -- 3. Create Kitting Job (if BOM exists)
                IF v_bom_id IS NOT NULL THEN
                    INSERT INTO jobs (tenant_id, service_opportunity_id, type, status, metadata)
                    VALUES (
                        v_tenant_id, 
                        p_service_opportunity_id, 
                        'Kitting', 
                        'Pending', 
                        jsonb_build_object('bom_id', v_bom_id, 'description', 'Prepare materials for ' || v_template_name)
                    )
                    RETURNING id INTO v_kitting_job_id;
                END IF;

                -- 4. Create Field Job
                INSERT INTO jobs (tenant_id, service_opportunity_id, type, status, assigned_to, dependency_job_id, metadata)
                VALUES (
                    v_tenant_id, 
                    p_service_opportunity_id, 
                    'Field', 
                    CASE WHEN v_kitting_job_id IS NOT NULL THEN 'Pending' ELSE 'Ready' END, 
                    p_assigned_to, 
                    v_kitting_job_id,
                    jsonb_build_object('description', 'Perform ' || v_template_name)
                )
                RETURNING id INTO v_field_job_id;

                -- 5. Update Opportunity Status
                UPDATE service_opportunities 
                SET status = 'In Progress' 
                WHERE id = p_service_opportunity_id;

                RETURN jsonb_build_object(
                    'success', true, 
                    'kitting_job_id', v_kitting_job_id, 
                    'field_job_id', v_field_job_id
                );
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)

        conn.commit()
        print("✅ RPC generate_service_workflow created successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_rpc()
