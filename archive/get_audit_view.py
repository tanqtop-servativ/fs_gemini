import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

try:
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    cur.execute("SELECT pg_get_viewdef('audit_history_view', true)")
    print("--- audit_history_view ---")
    print(cur.fetchone()[0])
    
    cur.close()
    conn.close()
except Exception as e:
    print(e)
