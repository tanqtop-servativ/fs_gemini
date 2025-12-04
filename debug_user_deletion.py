import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def debug_delete():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🐞 Attempting to delete user 'admin@testauth.com' to capture error...")

        # 1. Get User ID
        cur.execute("SELECT id FROM auth.users WHERE email = 'admin@testauth.com'")
        result = cur.fetchone()
        
        if not result:
            print("❌ User 'admin@testauth.com' not found.")
            return

        user_id = result[0]
        print(f"   Found User ID: {user_id}")

        # 2. Attempt Delete
        try:
            cur.execute("DELETE FROM auth.users WHERE id = %s", (user_id,))
            conn.commit()
            print("✅ User deleted successfully (Unexpectedly!)")
        except psycopg2.Error as e:
            print(f"❌ Deletion Failed!")
            print(f"   Error Code: {e.pgcode}")
            print(f"   Message: {e.pgerror}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ General Error: {e}")

if __name__ == "__main__":
    debug_delete()
