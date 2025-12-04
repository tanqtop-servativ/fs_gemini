import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_columns():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Adding trigger columns to service_opportunities...")
        cur.execute("""
            ALTER TABLE service_opportunities 
            ADD COLUMN IF NOT EXISTS trigger_source TEXT DEFAULT 'Manual', -- Manual, iCal, API, etc.
            ADD COLUMN IF NOT EXISTS trigger_metadata JSONB DEFAULT '{}'::jsonb; -- e.g. { "ical_event_id": "xyz" }
        """)

        conn.commit()
        print("✅ Added trigger_source and trigger_metadata columns.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_columns()
