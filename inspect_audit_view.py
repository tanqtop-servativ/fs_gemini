import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_view():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT pg_get_viewdef('audit_history_view', true);
        """)
        
        view_def = cur.fetchone()
        if view_def:
            print("--- View Definition: audit_history_view ---")
            print(view_def[0])
        else:
            print("View 'audit_history_view' not found.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_view()
