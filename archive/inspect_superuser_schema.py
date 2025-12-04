import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def get_table_info(cur, table_name):
    cur.execute(f"""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '{table_name}';
    """)
    return cur.fetchall()

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    tables = ['tenants', 'people', 'roles', 'person_roles']
    for table in tables:
        print(f"--- {table} ---")
        columns = get_table_info(cur, table)
        for col in columns:
            print(f"{col[0]} ({col[1]})")
        print("\n")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
