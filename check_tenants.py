import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def check_tenants():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Checking recent tenants...")
        cur.execute("SELECT id, name, created_at FROM tenants ORDER BY created_at DESC LIMIT 5")
        rows = cur.fetchall()
        for row in rows:
            print(row)
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_tenants()
