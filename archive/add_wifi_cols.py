import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Adding wifi_network column...")
    cur.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS wifi_network text;")
    
    print("Adding wifi_password column...")
    cur.execute("ALTER TABLE properties ADD COLUMN IF NOT EXISTS wifi_password text;")
    
    conn.commit()
    print("✅ Columns added successfully.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals() and conn:
        conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
