import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = 'users';
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Checking schema of 'users' table...")
    cur.execute(sql)
    rows = cur.fetchall()
    
    for row in rows:
        print(f"Schema: {row[0]} | Table: {row[1]}")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
