import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name IN ('audit_logs', 'audit_history_view');
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Checking for audit tables/views...")
    cur.execute(sql)
    rows = cur.fetchall()
    
    if not rows:
        print("❌ No audit tables or views found.")
    else:
        for row in rows:
            print(f"✅ Found {row[1]}: {row[0]}")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
