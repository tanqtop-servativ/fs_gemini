import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

try:
    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    # Check profiles
    cur.execute("SELECT * FROM profiles WHERE email LIKE '%kleenwerx.com%'")
    print("--- Chris in profiles ---")
    print(cur.fetchall())
    
    cur.close()
    conn.close()
except Exception as e:
    print(e)
