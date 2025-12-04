import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def verify_tenant_ids():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()

        print("Verifying tenant_id columns...")
        
        cur.execute("SELECT COUNT(*) FROM bookings WHERE tenant_id IS NULL")
        null_bookings = cur.fetchone()[0]
        print(f"Bookings with NULL tenant_id: {null_bookings}")
        
        cur.execute("SELECT COUNT(*) FROM audit_logs WHERE tenant_id IS NULL")
        null_audit = cur.fetchone()[0]
        print(f"Audit Logs with NULL tenant_id: {null_audit}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_tenant_ids()
