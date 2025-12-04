import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS bathroom_sinks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bath_mats INTEGER DEFAULT 0;
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Adding new columns...")
    cur.execute(sql)
    
    conn.commit()
    print("✅ Columns added successfully.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals() and conn:
        conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
