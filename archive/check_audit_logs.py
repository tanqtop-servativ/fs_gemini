import os
import psycopg2
from dotenv import load_dotenv
import json

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT id, table_name, operation, old_values, new_values, changed_at
FROM audit_logs
WHERE table_name = 'properties'
ORDER BY changed_at DESC
LIMIT 5;
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Checking audit_logs for 'properties'...")
    cur.execute(sql)
    rows = cur.fetchall()
    
    if not rows:
        print("❌ No audit logs found for 'properties'.")
    else:
        for row in rows:
            print(f"--- Log ID: {row[0]} ({row[2]}) ---")
            print(f"Time: {row[5]}")
            # Print a summary of changes if possible
            old = row[3]
            new = row[4]
            if old and new:
                diff = {k: (old.get(k), new.get(k)) for k in new if new.get(k) != old.get(k)}
                print(f"Diff: {json.dumps(diff, indent=2, default=str)}")
            else:
                print("No diff (Insert/Delete)")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
