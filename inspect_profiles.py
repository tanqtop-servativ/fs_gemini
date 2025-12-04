import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_profiles():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting 'profiles' table...")
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'profiles';
        """)
        if not cur.fetchone():
            print("❌ 'profiles' table not found.")
            return

        print("\n🔍 Schema:")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'profiles';
        """)
        for row in cur.fetchall():
            print(row)

        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    inspect_profiles()
