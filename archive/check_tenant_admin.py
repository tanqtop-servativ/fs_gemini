import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def check_admin(tenant_id):
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print(f"🔍 Checking admin for Tenant {tenant_id}...")
        cur.execute("SELECT id, first_name, last_name FROM profiles WHERE tenant_id = %s", (tenant_id,))
        rows = cur.fetchall()
        for row in rows:
            print(f"   User ID: {row[0]}")
            print(f"   Name: {row[1]} {row[2]}") 
            # Wait, profiles table has first/last, but maybe not email? 
            # My RPC added email to `people` but `profiles` schema only showed first/last/is_superuser.
            
        print("\n🔍 Checking People:")
        cur.execute("SELECT id, first_name, last_name, email, user_id FROM people WHERE tenant_id = %s", (tenant_id,))
        for row in cur.fetchall():
            print(f"   Person ID: {row[0]}")
            print(f"   Name: {row[1]} {row[2]}")
            print(f"   Email: {row[3]}")
            print(f"   User ID: {row[4]}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_admin(10)
