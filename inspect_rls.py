import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'audit_logs';
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Checking RLS policies on 'audit_logs'...")
    cur.execute(sql)
    rows = cur.fetchall()
    
    if not rows:
        print("❌ No RLS policies found on 'audit_logs'. (Table might be not readable if RLS is enabled)")
        
        # Check if RLS is enabled
        cur.execute("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'audit_logs'")
        rls_status = cur.fetchone()
        if rls_status:
            print(f"RLS Enabled: {rls_status[1]}")
    else:
        for row in rows:
            print(f"Policy: {row[1]} | Roles: {row[3]} | Cmd: {row[4]}")

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
