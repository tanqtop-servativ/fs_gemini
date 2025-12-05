import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_properties_schema():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        cur.execute("SELECT id, name FROM tenants;")
        rows = cur.fetchall()
        print(f"--- Tenants ({len(rows)}) ---")
        for r in rows:
            print(f"{r[0]} ({r[1]})")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    inspect_properties_schema()
