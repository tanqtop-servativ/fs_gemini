import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def verify_workflow():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🧪 Verifying Service Orchestration v2...")

        # 1. Create Service Opportunity (Airbnb Turnaround)
        print("   Creating Service Opportunity...")
        # Assuming Tenant ID 1 and Property ID 1 exist (from previous tests)
        cur.execute("""
            INSERT INTO service_opportunities (tenant_id, property_id, service_template_id, status, trigger_source)
            VALUES (1, 1, 1, 'Pending', 'Manual')
            RETURNING id;
        """)
        opp_id = cur.fetchone()[0]
        print(f"   Created Opportunity ID: {opp_id}")

        # 2. Generate Workflow
        print("   Generating Workflow...")
        cur.execute("SELECT generate_service_workflow(%s)", (opp_id,))
        result = cur.fetchone()[0]
        print(f"   Result: {json.dumps(result, indent=2)}")

        # 3. Verify Jobs
        cur.execute("""
            SELECT id, type, status, metadata 
            FROM jobs 
            WHERE service_opportunity_id = %s
            ORDER BY id ASC
        """, (opp_id,))
        jobs = cur.fetchall()
        
        print(f"   Found {len(jobs)} jobs:")
        
        job_map = {job[0]: job for job in jobs} # ID -> Job Row
        step_job_map = {} # Step Name -> Job ID

        for job in jobs:
            jid, jtype, jstatus, jmeta = job
            step_name = jmeta.get('step_name')
            step_job_map[step_name] = jid
            print(f"     - [{jid}] {jtype} ({step_name}): {jstatus}")

        # 4. Verify Dependencies
        # Kitting (No parent)
        # Cleaning (Parent: Kitting)
        # Inspection (Parent: Cleaning)
        # Invoice (Parent: Inspection)
        
        kitting_id = step_job_map.get('Initial Kitting')
        cleaning_id = step_job_map.get('Deep Cleaning')
        inspection_id = step_job_map.get('Quality Inspection')
        invoice_id = step_job_map.get('Generate Invoice')

        if not all([kitting_id, cleaning_id, inspection_id, invoice_id]):
            print("❌ Missing expected jobs!")
            return

        # Check Cleaning Parent
        cleaning_meta = job_map[cleaning_id][3]
        if cleaning_meta.get('parent_job_id') == kitting_id:
            print("     ✅ Cleaning depends on Kitting")
        else:
            print(f"     ❌ Cleaning dependency mismatch: {cleaning_meta.get('parent_job_id')} != {kitting_id}")

        # Check Inspection Parent
        inspection_meta = job_map[inspection_id][3]
        if inspection_meta.get('parent_job_id') == cleaning_id:
            print("     ✅ Inspection depends on Cleaning")
        else:
            print(f"     ❌ Inspection dependency mismatch: {inspection_meta.get('parent_job_id')} != {cleaning_id}")

        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_workflow()
