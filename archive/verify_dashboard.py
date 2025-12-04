import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def verify_dashboard():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🧪 Verifying Horizon Board RPC...")

        # 1. Call RPC
        cur.execute("SELECT get_dashboard_horizon(1)")
        result = cur.fetchone()[0]
        
        print(f"   Result Count: {len(result)}")
        
        # 2. Inspect Buckets
        buckets = {}
        for job in result:
            b = job.get('bucket')
            buckets[b] = buckets.get(b, 0) + 1
            
        print("   Buckets Distribution:")
        for b, count in buckets.items():
            print(f"     - {b}: {count}")

        # 3. Check specific job details
        if result:
            sample = result[0]
            print(f"   Sample Job: {sample.get('type')} - {sample.get('bucket')} (Scheduled: {sample.get('scheduled_at')})")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_dashboard()
