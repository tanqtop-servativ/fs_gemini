import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_roles():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting 'roles' table...")
        cur.execute("SELECT * FROM roles LIMIT 5")
        rows = cur.fetchall()
        for row in rows:
            print(row)
            
        print("\n🔍 Schema:")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'roles';
        """)
        for row in cur.fetchall():
            print(row)

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    inspect_roles()
