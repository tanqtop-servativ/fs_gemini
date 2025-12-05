import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_columns():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Adding columns to job_templates...")
        cur.execute("""
            ALTER TABLE job_templates 
            ADD COLUMN IF NOT EXISTS name_es TEXT,
            ADD COLUMN IF NOT EXISTS description_es TEXT;
        """)
        
        print("Adding columns to job_template_tasks...")
        cur.execute("""
            ALTER TABLE job_template_tasks 
            ADD COLUMN IF NOT EXISTS description TEXT,
            ADD COLUMN IF NOT EXISTS title_es TEXT,
            ADD COLUMN IF NOT EXISTS description_es TEXT,
            ADD COLUMN IF NOT EXISTS require_photo BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
        """)
        
        conn.commit()
        print("✅ Columns added successfully.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    add_columns()
