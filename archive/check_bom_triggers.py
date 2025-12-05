import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

try:
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    tables = ['bom_templates', 'bom_template_items']
    
    for table in tables:
        print(f"\n--- Triggers on {table} ---")
        cur.execute(f"""
        SELECT tgname, pg_get_triggerdef(oid)
        FROM pg_trigger
        WHERE tgrelid = '{table}'::regclass;
        """)
        triggers = cur.fetchall()
        if not triggers:
            print("No triggers found.")
        for t in triggers:
            print(f"{t[0]}: {t[1]}")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
