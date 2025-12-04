import os
import psycopg2
import json
import time
from dotenv import load_dotenv
from queue_worker import process_queue

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def verify_enhancements():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🧪 Testing Queue Enhancements...")

        # 1. Clear Queue
        cur.execute("DELETE FROM job_queue")
        conn.commit()

        # 2. Insert Failing Job (Invalid Photo ID)
        print("   Inserting Failing Job...")
        cur.execute("""
            INSERT INTO job_queue (action_type, payload, status, max_attempts)
            VALUES ('COMPRESS_PHOTO', '{"photo_id": -1, "storage_path": "invalid.jpg"}', 'PENDING', 3)
            RETURNING id
        """)
        fail_id = cur.fetchone()[0]
        conn.commit()

        # 3. Run Worker (Should Fail and Retry)
        print("   Running Worker (Expect Failure)...")
        process_queue()

        # 4. Verify Retry State
        cur.execute("SELECT status, attempts, run_after, error_message FROM job_queue WHERE id = %s", (fail_id,))
        status, attempts, run_after, error = cur.fetchone()
        
        print(f"   Job #{fail_id} Status: {status}, Attempts: {attempts}")
        if attempts == 1 and status == 'PENDING' and error:
            print("   ✅ Retry logic working (Attempt 1 recorded, scheduled for retry).")
        else:
            print(f"   ❌ Retry logic failed: {status}, {attempts}, {error}")

        # 5. Insert Success Job (Mock Create Job)
        print("   Inserting Success Job...")
        cur.execute("""
            INSERT INTO job_queue (action_type, payload, status)
            VALUES ('CREATE_JOB', '{"foo": "bar"}', 'PENDING')
            RETURNING id
        """)
        success_id = cur.fetchone()[0]
        conn.commit()

        # 6. Run Worker (Should Succeed)
        print("   Running Worker (Expect Success)...")
        process_queue()

        # 7. Verify Success
        cur.execute("SELECT status, attempts FROM job_queue WHERE id = %s", (success_id,))
        status, attempts = cur.fetchone()
        
        print(f"   Job #{success_id} Status: {status}")
        if status == 'COMPLETED':
            print("   ✅ Success logic working.")
        else:
            print(f"   ❌ Success logic failed: {status}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_enhancements()
