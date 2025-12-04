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
        
        # 1. Find a valid Service Opportunity (or create one)
        # For simplicity, we'll pick the first one or fail
        cur.execute("SELECT id FROM service_opportunities LIMIT 1")
        res = cur.fetchone()
        if not res:
            print("❌ No service opportunities found. Cannot test.")
            return
        opp_id = res[0]
        
        print(f"Testing with Opportunity ID: {opp_id}")

        # 2. Call generate_service_workflow
        print("Generating workflow...")
        cur.execute("SELECT generate_service_workflow(%s)", (opp_id,))
        result = cur.fetchone()[0]
        print(f"Result: {json.dumps(result, indent=2)}")
        
        if not result.get('success'):
            print("❌ Workflow generation failed.")
            return

        kitting_id = result.get('kitting_job_id')
        field_id = result.get('field_job_id')
        
        if not kitting_id or not field_id:
            print("❌ Jobs not created as expected.")
            return

        # 3. Verify Initial Status
        cur.execute("SELECT status FROM jobs WHERE id = %s", (field_id,))
        status = cur.fetchone()[0]
        print(f"Initial Field Job Status: {status}")
        if status != 'Ready':
            print("❌ Field job should be Ready.")
        else:
            print("✅ Field job is Ready.")

        # 4. Update Kitting Job
        print("Updating Kitting Job (Complete, Shelf A1, 5 Bags, Red)...")
        cur.execute("""
            UPDATE jobs 
            SET status = 'Complete', 
                metadata = metadata || '{"shelf": "A1", "bags": 5, "color": "Red"}'::jsonb
            WHERE id = %s
        """, (kitting_id,))
        
        # 5. Verify Field Job Metadata Updated
        cur.execute("SELECT metadata FROM jobs WHERE id = %s", (field_id,))
        metadata = cur.fetchone()[0]
        print(f"Field Job Metadata: {json.dumps(metadata, indent=2)}")
        
        if metadata.get('kitting_status') == 'Complete' and metadata.get('kitting_shelf') == 'A1':
            print("✅ Data synced successfully!")
        else:
            print("❌ Data sync failed.")

        conn.commit() # Commit changes to keep them (or rollback if we want to clean up, but keeping is fine for manual verification)
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_workflow()
