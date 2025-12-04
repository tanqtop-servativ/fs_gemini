import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_triggers():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting Constraints on 'profiles' table...")
        
        query = """
        SELECT conname, contype, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conrelid = 'profiles'::regclass;
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        for row in rows:
            print(f"   Constraint: {row[0]} ({row[1]}) - {row[2]}")
        
        cur.execute(query)
        rows = cur.fetchall()
        
        if not rows:
            print("   No triggers found.")
        
        for row in rows:
            print(f"   Trigger: {row[0]}")
            print(f"     Event: {row[1]}")
            print(f"     Timing: {row[4]} {row[3]}")
            print(f"     Action: {row[2]}")
            print("-" * 40)
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    inspect_triggers()
