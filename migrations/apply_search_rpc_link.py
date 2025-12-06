
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ.get("DB_CONNECTION_STRING"))
conn.autocommit = True
cur = conn.cursor()

with open("migrations/update_search_rpc_link.sql", "r") as f:
    sql = f.read()

try:
    print("Applying Search RPC Link update...")
    cur.execute(sql)
    print("Update applied successfully!")
except Exception as e:
    print(f"Error applying update: {e}")

cur.close()
conn.close()
