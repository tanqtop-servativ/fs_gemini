import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_func():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT pg_get_functiondef(oid) 
            FROM pg_proc 
            WHERE proname = 'record_audit_log';
        """)
        
        row = cur.fetchone()
        if row:
            print(row[0])
        else:
            print("Function not found.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    inspect_func()
