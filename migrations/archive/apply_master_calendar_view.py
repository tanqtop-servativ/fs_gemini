
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def apply_migration():
    if not DB_CONNECTION_STRING:
        print("❌ Error: DB_CONNECTION_STRING not found.")
        return

    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # Read the file
        with open('migrations/create_master_calendar_view.sql', 'r') as f:
            sql_content = f.read()
            
        print("Applying migrations/create_master_calendar_view.sql...")
        cur.execute(sql_content)
        conn.commit()
        print("✅ Migration applied successfully.")
        
    except Exception as e:
        print(f"❌ Error applying migration: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    apply_migration()
