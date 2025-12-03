import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

# First get the function name for the trigger
sql_trigger = """
SELECT action_statement
FROM information_schema.triggers
WHERE event_object_table = 'properties' AND trigger_name = 'audit_props_trigger';
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    cur.execute(sql_trigger)
    row = cur.fetchone()
    
    if row:
        # action_statement usually looks like "EXECUTE FUNCTION function_name()"
        func_call = row[0]
        print(f"Trigger Action: {func_call}")
        
        # Extract function name (simple parsing)
        func_name = func_call.replace("EXECUTE FUNCTION ", "").replace("()", "").strip()
        
        # Get function definition
        sql_func = f"SELECT pg_get_functiondef('{func_name}'::regproc);"
        cur.execute(sql_func)
        func_def = cur.fetchone()
        if func_def:
            print("\n--- Function Definition ---")
            print(func_def[0])
        else:
            print(f"❌ Could not retrieve definition for {func_name}")
            
    else:
        print("❌ Trigger not found.")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
