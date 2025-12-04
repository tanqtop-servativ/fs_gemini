import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_templates():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting Job Templates...")
        cur.execute("SELECT id, name FROM job_templates")
        rows = cur.fetchall()
        
        for row in rows:
            print(f"   [{row[0]}] {row[1]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    inspect_templates()
