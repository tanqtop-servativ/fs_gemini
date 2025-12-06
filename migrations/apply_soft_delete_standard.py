import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Connect to your database
conn = psycopg2.connect(
    os.environ.get("DB_CONNECTION_STRING")
)
cur = conn.cursor()

# Read the SQL file
with open('migrations/standardize_property_soft_delete.sql', 'r') as f:
    sql = f.read()

try:
    print("Applying migration: Standardize Property Soft Delete...")
    cur.execute(sql)
    conn.commit()
    print("Migration successful.")
except Exception as e:
    print(f"Migration failed: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
