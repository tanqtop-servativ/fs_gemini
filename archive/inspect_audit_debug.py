import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

if not db_connection_string:
    print("Error: DB_CONNECTION_STRING not set")
    exit(1)

try:
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    # Get save_person_safe definition
    query_rpc = """
    SELECT pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname = 'save_person_safe';
    """
    cur.execute(query_rpc)
    rpc_def = cur.fetchone()
    
    if rpc_def:
        print("--- save_person_safe Definition ---")
        print(rpc_def[0])
    else:
        print("save_person_safe not found")

    # Get triggers on people table
    query_triggers = """
    SELECT tgname, pg_get_triggerdef(oid)
    FROM pg_trigger
    WHERE tgrelid = 'people'::regclass;
    """
    cur.execute(query_triggers)
    triggers = cur.fetchall()
    
    print("\n--- Triggers on people table ---")
    for t in triggers:
        print(f"{t[0]}: {t[1]}")

    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {e}")
