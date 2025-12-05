import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

try:
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    # Check for Chris
    cur.execute("SELECT * FROM app_users WHERE email LIKE '%kleenwerx.com%'")
    print("--- Chris in app_users ---")
    print(cur.fetchall())

    # Check recent audit logs
    cur.execute("SELECT changed_by, changed_at FROM audit_logs ORDER BY changed_at DESC LIMIT 5")
    print("\n--- Recent Audit Logs ---")
    for row in cur.fetchall():
        print(row)
    
    cur.close()
    conn.close()
except Exception as e:
    print(e)
