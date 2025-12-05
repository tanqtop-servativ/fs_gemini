import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def cleanup_update_dupes():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Dropping duplicate update_job_template...")
        cur.execute("DROP FUNCTION IF EXISTS public.update_job_template(integer, text, text, text, text, jsonb);")
        
        conn.commit()
        print("✅ Cleanup successful.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    cleanup_update_dupes()
