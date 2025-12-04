import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_column():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Adding scheduled_at to jobs...")
        cur.execute("""
            ALTER TABLE jobs 
            ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
        """)
        
        conn.commit()
        print("✅ Column added successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_column()
