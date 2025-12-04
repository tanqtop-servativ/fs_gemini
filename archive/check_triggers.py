import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

def check_triggers():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        
        print("--- TABLES WITH AUDIT TRIGGER ---")
        cur.execute("""
            SELECT event_object_table, trigger_name
            FROM information_schema.triggers
            WHERE trigger_name = 'audit_trigger'
            ORDER BY event_object_table;
        """)
        
        rows = cur.fetchall()
        if not rows:
            print("No tables have 'audit_trigger'.")
        else:
            for row in rows:
                print(f"✅ {row[0]}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    check_triggers()
