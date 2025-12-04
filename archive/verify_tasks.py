import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def verify_tasks():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🧪 Verifying Task Creation...")

        # 1. Create Service Opportunity
        cur.execute("""
            INSERT INTO service_opportunities (tenant_id, property_id, service_template_id, status, trigger_source)
            VALUES (1, 1, 1, 'Pending', 'Manual')
            RETURNING id;
        """)
        opp_id = cur.fetchone()[0]
        print(f"   Created Opportunity ID: {opp_id}")

        # 2. Generate Workflow
        cur.execute("SELECT generate_service_workflow(%s)", (opp_id,))
        result = cur.fetchone()[0]
        print(f"   Workflow Generated.")

        # 3. Find Cleaning Job
        cleaning_job_id = None
        for item in result:
            if item['type'] == 'Field': # Assuming Cleaning maps to Field type in our template
                cleaning_job_id = item['job_id']
                print(f"   Found Field Job ID: {cleaning_job_id}")
                break
        
        if not cleaning_job_id:
            print("❌ Cleaning/Field job not found in workflow.")
            return

        # 4. Check Tasks
        cur.execute("SELECT id, title, status FROM job_tasks WHERE job_id = %s", (cleaning_job_id,))
        tasks = cur.fetchall()
        
        print(f"   Found {len(tasks)} tasks for Job {cleaning_job_id}:")
        for t in tasks:
            print(f"     - [{t[0]}] {t[1]} ({t[2]})")

        if len(tasks) > 0:
            print("✅ Tasks verified.")
        else:
            print("❌ No tasks found!")

        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_tasks()
