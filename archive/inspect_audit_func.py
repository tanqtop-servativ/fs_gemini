import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_function():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting function 'create_tenant_for_user'...")
        
        cur.execute("""
            SELECT pg_get_functiondef('create_tenant_for_user'::regproc);
        """)
        result = cur.fetchone()
        
        if result:
            print(result[0])
        else:
            print("❌ Function not found.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    inspect_function()
