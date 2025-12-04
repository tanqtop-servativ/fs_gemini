import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_columns():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        tables_to_update = ['bom_templates', 'job_templates', 'service_opportunities', 'roles']
        
        print("🚀 Adding 'deleted_at' column to tables...")
        
        for table in tables_to_update:
            try:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;")
                print(f"✅ Added deleted_at to {table}")
            except Exception as e:
                print(f"❌ Error adding to {table}: {e}")
                conn.rollback()
        
        conn.commit()
        print("🎉 Column addition complete.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    add_columns()
