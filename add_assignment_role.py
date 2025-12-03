import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
ALTER TABLE property_assignments 
ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id);
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Adding role_id to property_assignments...")
    cur.execute(sql)
    
    conn.commit()
    print("✅ Column added successfully.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals() and conn:
        conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
