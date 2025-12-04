import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_rpc():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Creating get_dashboard_horizon RPC...")

        cur.execute("DROP FUNCTION IF EXISTS get_dashboard_horizon(integer);")

        cur.execute("""
            CREATE OR REPLACE FUNCTION get_dashboard_horizon(p_tenant_id INTEGER)
            RETURNS JSONB
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_jobs JSONB;
            BEGIN
                -- Fetch active jobs enriched with property and service info
                -- We bucketize in the query for efficiency, or just return raw data.
                -- Let's return a flat list with a 'bucket' field.
                
                SELECT jsonb_agg(t) INTO v_jobs
                FROM (
                    SELECT 
                        j.id,
                        j.type,
                        j.status,
                        j.scheduled_at,
                        j.created_at,
                        j.metadata,
                        p.name as property_name,
                        st.name as service_name,
                        CASE
                            WHEN j.status = 'Complete' THEN 'completed' -- Maybe filter these out or show in Today?
                            WHEN (COALESCE(j.scheduled_at, so.due_date, j.created_at) < CURRENT_DATE) THEN 'overdue'
                            WHEN (COALESCE(j.scheduled_at, so.due_date, j.created_at)::DATE = CURRENT_DATE) THEN 'today'
                            WHEN (COALESCE(j.scheduled_at, so.due_date, j.created_at)::DATE = CURRENT_DATE + 1) THEN 'tomorrow'
                            WHEN (COALESCE(j.scheduled_at, so.due_date, j.created_at)::DATE <= (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '6 days')::DATE) THEN 'this_week'
                            WHEN (COALESCE(j.scheduled_at, so.due_date, j.created_at)::DATE <= (DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '13 days')::DATE) THEN 'next_week'
                            ELSE 'future'
                        END as bucket
                    FROM jobs j
                    JOIN service_opportunities so ON j.service_opportunity_id = so.id
                    JOIN properties p ON so.property_id = p.id
                    LEFT JOIN service_templates st ON so.service_template_id = st.id
                    WHERE j.tenant_id = p_tenant_id
                      AND j.status != 'Complete' -- Only active jobs for now
                    ORDER BY COALESCE(j.scheduled_at, so.due_date, j.created_at) ASC
                ) t;

                RETURN COALESCE(v_jobs, '[]'::jsonb);
            END;
            $$;
        """)
        
        conn.commit()
        print("✅ RPC created successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_rpc()
