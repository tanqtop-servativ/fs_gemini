import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def verify_view():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🧪 Verifying Master Calendar View...")

        # 1. Fetch from view
        cur.execute("SELECT id, title, start_date, property_name, property_address FROM master_calendar LIMIT 5")
        rows = cur.fetchall()
        
        print(f"   Found {len(rows)} rows:")
        for row in rows:
            print(f"     - {row[1]} @ {row[3]} ({row[4]})")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    verify_view()
