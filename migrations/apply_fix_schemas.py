import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def apply_migration():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # Read SQL file
        with open('migrations/fix_property_related_schemas.sql', 'r') as f:
            sql = f.read()
            
        print("Applying migration: fix_property_related_schemas.sql...")
        cur.execute(sql)
        conn.commit()
        print("✅ Migration applied successfully.")
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    apply_migration()
