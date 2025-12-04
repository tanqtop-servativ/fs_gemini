import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Adding 'created_at' to 'tenants'...")
    cur.execute(sql)
    conn.commit()
    print("✅ Column added successfully.")
            
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
