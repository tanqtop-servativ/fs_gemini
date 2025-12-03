import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_table(cur, table_name):
    print(f"\n--- {table_name} ---")
    cur.execute(f"""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = '{table_name}';
    """)
    columns = cur.fetchall()
    for col in columns:
        print(col)

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    inspect_table(cur, 'job_templates')
    inspect_table(cur, 'job_template_tasks')
    
    # Check for RPCs
    print("\n--- Related Functions ---")
    cur.execute("""
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_name LIKE '%job_template%';
    """)
    funcs = cur.fetchall()
    for f in funcs:
        print(f)

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
