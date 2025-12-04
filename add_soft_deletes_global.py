import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

TABLES = [
    "bom_templates",
    "roles",
    "job_templates",
    "property_attachments",
    "property_reference_photos",
    "app_users"
]

def run_migration():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        
        print("🚀 Adding Global Soft Deletes...")
        
        for table in TABLES:
            try:
                cmd = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;"
                cur.execute(cmd)
                print(f"✅ {table}: Added deleted_at")
            except Exception as e:
                print(f"❌ {table}: Error - {e}")
                conn.rollback()
                return

        conn.commit()
        print("🎉 Migration Complete!")

    except Exception as e:
        print(f"❌ Connection Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    run_migration()
