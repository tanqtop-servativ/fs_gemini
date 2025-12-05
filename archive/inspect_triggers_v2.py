import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), '.env'))

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_triggers():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting Triggers...")
        cur.execute("""
            SELECT event_object_table, trigger_name, action_statement 
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public'
            ORDER BY event_object_table;
        """)
        triggers = cur.fetchall()
        
        if not triggers:
            print("❌ No triggers found.")
        else:
            for t in triggers:
                print(f"   Table: {t[0]} | Trigger: {t[1]}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_triggers()
