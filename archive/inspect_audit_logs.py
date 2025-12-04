import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_audit_logs():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        
        print("--- AUDIT_LOGS COLUMNS ---")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'audit_logs';
        """)
        for row in cur.fetchall():
            print(f"{row[0]} ({row[1]})")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    inspect_audit_logs()
