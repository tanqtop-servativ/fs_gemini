import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

try:
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    # Check what app_users is
    cur.execute("SELECT relkind FROM pg_class WHERE relname = 'app_users'")
    kind = cur.fetchone()
    print(f"RelKind: {kind}")

    # Try to select
    try:
        cur.execute("SELECT * FROM app_users LIMIT 1")
        print("Select success:", cur.fetchone())
    except Exception as e:
        print("Select failed:", e)
    
    cur.close()
    conn.close()
except Exception as e:
    print(e)
