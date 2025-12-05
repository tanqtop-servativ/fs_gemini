import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def cleanup_dupes():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Dropping duplicate functions...")
        # Drop the one with integer
        cur.execute("DROP FUNCTION IF EXISTS public.create_job_template(text, text, text, text, integer, jsonb);")
        
        # Also check update_job_template
        cur.execute("""
            SELECT oid, proname, proargtypes::regtype[]
            FROM pg_proc
            WHERE proname = 'update_job_template';
        """)
        results = cur.fetchall()
        print("Update functions found:")
        for row in results:
            print(f" - OID: {row[0]}, Args: {row[2]}")
            
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
    cleanup_dupes()
