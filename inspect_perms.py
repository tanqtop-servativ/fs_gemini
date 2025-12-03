import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('audit_logs', 'audit_history_view')
AND grantee IN ('anon', 'authenticated', 'service_role');
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Checking permissions...")
    cur.execute(sql)
    rows = cur.fetchall()
    
    if not rows:
        print("❌ No permissions found for anon/authenticated on audit tables.")
    else:
        for row in rows:
            print(f"User: {row[0]} | Table: {row[1]} | Privilege: {row[2]}")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
