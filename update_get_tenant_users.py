import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def run_migration():
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()

    # Redefine get_tenant_users to filter out deleted users
    # I am assuming the signature based on usage in superuser.js: get_tenant_users(p_tenant_id)
    # And it returns a table or setof records.
    
    SQL = """
    DROP FUNCTION IF EXISTS public.get_tenant_users(integer);
    
    CREATE OR REPLACE FUNCTION public.get_tenant_users(p_tenant_id integer)
     RETURNS SETOF app_users
     LANGUAGE sql
     SECURITY DEFINER
    AS $function$
        SELECT * FROM app_users 
        WHERE tenant_id = p_tenant_id 
        AND deleted_at IS NULL
        ORDER BY created_at DESC;
    $function$;
    """

    try:
        print("Updating get_tenant_users function...")
        cur.execute(SQL)
        conn.commit()
        print("Success!")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
