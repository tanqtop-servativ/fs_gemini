
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Connect to your postgres DB
conn = psycopg2.connect(os.environ.get("DB_CONNECTION_STRING"))
conn.autocommit = True
cur = conn.cursor()

# Read the SQL file
with open("migrations/create_global_search.sql", "r") as f:
    sql = f.read()

try:
    print("Applying Global Search migration...")
    cur.execute(sql)
    print("Migration applied successfully!")
except Exception as e:
    print(f"Error applying migration: {e}")

cur.close()
conn.close()
