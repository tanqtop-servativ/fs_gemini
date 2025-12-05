import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

try:
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    # Check profiles columns
    cur.execute("SELECT * FROM profiles LIMIT 1")
    col_names = [desc[0] for desc in cur.description]
    print(f"Profiles Columns: {col_names}")

    # Check auth.users access
    try:
        cur.execute("SELECT id, email FROM auth.users LIMIT 1")
        print("auth.users access: Success")
        print(cur.fetchone())
    except Exception as e:
        print("auth.users access: Failed", e)
    
    cur.close()
    conn.close()
except Exception as e:
    print(e)
