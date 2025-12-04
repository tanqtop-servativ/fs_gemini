import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_funcs():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        
        funcs = ['delete_tenant', 'manage_tenant_user']
        
        for f in funcs:
            print(f"--- {f} ---")
            cur.execute(f"""
                SELECT pg_get_functiondef(oid) 
                FROM pg_proc 
                WHERE proname = '{f}';
            """)
            
            row = cur.fetchone()
            if row:
                print(row[0])
            else:
                print("Function not found.")
            print("\n")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    inspect_funcs()
