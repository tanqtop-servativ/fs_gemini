import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_logs';
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Checking columns of 'audit_logs'...")
    cur.execute(sql)
    rows = cur.fetchall()
    
    if not rows:
        print("❌ Table 'audit_logs' not found.")
    else:
        for row in rows:
            print(f"{row[0]} ({row[1]})")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
