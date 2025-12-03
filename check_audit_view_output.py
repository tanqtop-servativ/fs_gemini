import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    # Check schema
    print("--- Schema of audit_logs ---")
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs'")
    for col in cur.fetchall():
        print(f"{col[0]} ({col[1]})")
        
    # Check view output
    print("\n--- View Output (Top 5) ---")
    cur.execute("SELECT * FROM audit_history_view WHERE table_name = 'properties' ORDER BY changed_at DESC LIMIT 5")
    cols = [desc[0] for desc in cur.description]
    print(f"Columns: {cols}")
    for row in cur.fetchall():
        print(row)
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
