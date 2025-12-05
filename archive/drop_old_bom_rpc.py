import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

drop_sql = """
DROP FUNCTION IF EXISTS public.create_bom_template(text, text, jsonb, integer);
DROP FUNCTION IF EXISTS public.update_bom_template(integer, text, text, jsonb);
"""

def drop_old_rpcs():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Dropping old RPC functions...")
        cur.execute(drop_sql)
        
        conn.commit()
        print("✅ Old RPC functions dropped successfully.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    drop_old_rpcs()
