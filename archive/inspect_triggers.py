import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT event_object_table, trigger_name, event_manipulation, action_statement, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'properties';
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Checking triggers on 'properties' table...")
    cur.execute(sql)
    rows = cur.fetchall()
    
    if not rows:
        print("❌ No triggers found on 'properties' table.")
    else:
        for row in rows:
            print(f"✅ Trigger: {row[1]} ({row[2]}) - {row[4]}")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
