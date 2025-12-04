import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_app_users():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting 'app_users'...")
        
        # Check if table or view
        cur.execute("""
            SELECT table_type 
            FROM information_schema.tables 
            WHERE table_name = 'app_users';
        """)
        result = cur.fetchone()
        
        if result:
            print(f"   Type: {result[0]}")
            
            if result[0] == 'VIEW':
                print("   View Definition:")
                cur.execute("SELECT pg_get_viewdef('app_users', true)")
                print(cur.fetchone()[0])
        else:
            print("❌ 'app_users' not found.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    inspect_app_users()
