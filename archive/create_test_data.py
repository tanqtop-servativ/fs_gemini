import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_test_data():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # 1. Ensure Tenant (ID 1)
        cur.execute("INSERT INTO tenants (id, name) VALUES (1, 'Test Tenant') ON CONFLICT (id) DO NOTHING")
        
        # 2. Ensure Property
        cur.execute("INSERT INTO properties (tenant_id, name) VALUES (1, 'Test Property') RETURNING id")
        prop_id = cur.fetchone()[0]
        
        # 3. Ensure Job Template (with BOM)
        # First ensure BOM
        cur.execute("INSERT INTO bom_templates (tenant_id, name) VALUES (1, 'Test BOM') RETURNING id")
        bom_id = cur.fetchone()[0]
        
        cur.execute("INSERT INTO job_templates (tenant_id, name, bom_id) VALUES (1, 'Test Service', %s) RETURNING id", (bom_id,))
        tmpl_id = cur.fetchone()[0]
        
        # 4. Create Service Opportunity
        cur.execute("""
            INSERT INTO service_opportunities (tenant_id, property_id, job_template_id, status)
            VALUES (1, %s, %s, 'Pending')
            RETURNING id
        """, (prop_id, tmpl_id))
        opp_id = cur.fetchone()[0]
        
        conn.commit()
        print(f"✅ Created Test Data. Opportunity ID: {opp_id}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_test_data()
