import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_properties_schema():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT oid::regprocedure
            FROM pg_proc 
            WHERE proname IN ('delete_property_safe', 'delete_tenant', 'manage_tenant_user', 'sync_ical_data', 'update_tenant', 'create_property_safe', 'update_property_safe')
            ORDER BY proname;
        """)
        
        funcs = cur.fetchall()
        print(f"--- Function Signatures ({len(funcs)} found) ---")
        for f in funcs:
            print(f"{f[0]}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    inspect_properties_schema()
