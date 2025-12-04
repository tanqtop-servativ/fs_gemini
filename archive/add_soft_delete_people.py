import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

SQL_COMMANDS = [
    # 1. Add deleted_at column
    "ALTER TABLE people ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;",
    
    # 2. Update View
    "DROP VIEW IF EXISTS people_enriched;",
    
    """
    CREATE OR REPLACE VIEW people_enriched AS
    SELECT 
        p.*,
        (
            SELECT string_agg(r.name, ', ')
            FROM person_roles pr
            JOIN roles r ON r.id = pr.role_id
            WHERE pr.person_id = p.id
        ) as roles_display,
        ARRAY(
            SELECT role_id 
            FROM person_roles pr 
            WHERE pr.person_id = p.id
        ) as role_ids
    FROM people p;
    """
]

def run_migration():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        
        print("🚀 Adding Soft Delete to People...")
        
        for cmd in SQL_COMMANDS:
            try:
                cur.execute(cmd)
                print(f"✅ Executed: {cmd[:50].strip()}...")
            except Exception as e:
                print(f"❌ Error executing: {cmd[:50]}...\n{e}")
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
