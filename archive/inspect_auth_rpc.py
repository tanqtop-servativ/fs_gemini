import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'verify_app_access';
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    cur.execute(sql)
    row = cur.fetchone()
    
    if row:
        print(row[0])
    else:
        print("❌ Function verify_app_access not found.")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
