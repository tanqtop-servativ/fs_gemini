
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_schema():
    if not DB_CONNECTION_STRING:
        print("❌ Error: DB_CONNECTION_STRING not found.")
        return

    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("--- job_queue Columns ---")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'job_queue';
        """)
        for col in cur.fetchall():
            print(f"- {col[0]} ({col[1]})")

    except Exception as e:
        print(f"❌ Error inspecting schema: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    inspect_schema()
