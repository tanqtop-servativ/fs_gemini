import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_functions():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # Query to find functions with integer arguments
        # We look for arguments named like '%id%' that are of type integer
        query = """
        SELECT 
            n.nspname as schema,
            p.proname as function_name,
            pg_get_function_arguments(p.oid) as arguments
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND (
            pg_get_function_arguments(p.oid) ILIKE '%id%integer%' 
            OR pg_get_function_arguments(p.oid) ILIKE '%id%int%'
        )
        ORDER BY p.proname;
        """
        
        cur.execute(query)
        funcs = cur.fetchall()
        
        print(f"--- Found {len(funcs)} functions with potential Integer ID arguments ---")
        for f in funcs:
            print(f"Function: {f[1]}")
            print(f"Arguments: {f[2]}")
            print("-" * 40)
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    inspect_functions()
