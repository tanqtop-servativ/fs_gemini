
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ.get("DB_CONNECTION_STRING"))
conn.autocommit = True
cur = conn.cursor()

with open("migrations/enable_rls.sql", "r") as f:
    sql = f.read()

try:
    print("Applying RLS migration...")
    cur.execute(sql)
    print("RLS applied successfully!")
except Exception as e:
    print(f"Error applying RLS: {e}")

cur.close()
conn.close()
