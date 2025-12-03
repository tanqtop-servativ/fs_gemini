import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_schema():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("1. Creating service_opportunities table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS service_opportunities (
                id SERIAL PRIMARY KEY,
                tenant_id INT REFERENCES tenants(id) NOT NULL,
                property_id INT REFERENCES properties(id) NOT NULL,
                job_template_id INT REFERENCES job_templates(id),
                status TEXT DEFAULT 'Pending', -- Pending, In Progress, Complete, Cancelled
                due_date TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            ALTER TABLE service_opportunities ENABLE ROW LEVEL SECURITY;
            
            -- RLS: Tenants can only see their own opportunities
            DROP POLICY IF EXISTS "Tenant Isolation" ON service_opportunities;
            CREATE POLICY "Tenant Isolation" ON service_opportunities
                USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
        """)

        print("2. Creating jobs table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                tenant_id INT REFERENCES tenants(id) NOT NULL,
                service_opportunity_id INT REFERENCES service_opportunities(id) ON DELETE CASCADE,
                type TEXT NOT NULL, -- Kitting, Field, Inspection
                status TEXT DEFAULT 'Pending', -- Pending, Ready, In Progress, Complete
                assigned_to INT REFERENCES people(id),
                dependency_job_id INT REFERENCES jobs(id), -- Blocked by this job
                metadata JSONB DEFAULT '{}'::jsonb, -- bag_count, color, shelf_location
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
            
            -- RLS: Tenants can only see their own jobs
            DROP POLICY IF EXISTS "Tenant Isolation" ON jobs;
            CREATE POLICY "Tenant Isolation" ON jobs
                USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
        """)

        conn.commit()
        print("✅ Service Orchestration Schema created successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_schema()
