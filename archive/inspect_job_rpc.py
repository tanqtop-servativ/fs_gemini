import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def get_func_def(cur, func_name):
    print(f"\n--- {func_name} ---")
    cur.execute(f"""
        SELECT pg_get_functiondef(oid)
        FROM pg_proc
        WHERE proname = '{func_name}';
    """)
    res = cur.fetchone()
    if res:
        print(res[0])
    else:
        print("Not found.")

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    get_func_def(cur, 'create_job_template')
    get_func_def(cur, 'update_job_template')

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
