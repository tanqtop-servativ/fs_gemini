import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    # List all functions with this name and their argument types
    sql = """
    SELECT oid, pg_get_function_identity_arguments(oid) 
    FROM pg_proc 
    WHERE proname = 'create_property_safe';
    """
    cur.execute(sql)
    rows = cur.fetchall()
    
    print("--- Versions of create_property_safe ---")
    for r in rows:
        print(f"OID: {r[0]}")
        print(f"Args: {r[1]}")
        print("-" * 20)
        
        # Get definition for this specific OID
        cur.execute(f"select pg_get_functiondef({r[0]})")
        print(cur.fetchone()[0])
        print("=" * 40)

    # Same for update
    sql = """
    SELECT oid, pg_get_function_identity_arguments(oid) 
    FROM pg_proc 
    WHERE proname = 'update_property_safe';
    """
    cur.execute(sql)
    rows = cur.fetchall()
    print("\n--- Versions of update_property_safe ---")
    for r in rows:
        print(f"OID: {r[0]}")
        print(f"Args: {r[1]}")
        print("-" * 20)
        cur.execute(f"select pg_get_functiondef({r[0]})")
        print(cur.fetchone()[0])
        print("=" * 40)

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
