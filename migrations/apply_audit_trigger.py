import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get DB connection string
DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

if not DB_CONNECTION_STRING:
    print("Error: DB_CONNECTION_STRING is not set.")
    exit(1)

def apply_migration():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()

        migration_file = "migrations/enable_audit_service_opportunities.sql"
        print(f"Applying migration: {migration_file}")

        with open(migration_file, "r") as f:
            sql = f.read()
            cur.execute(sql)
        
        conn.commit()
        print("Migration applied successfully!")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error applying migration: {e}")
        exit(1)

if __name__ == "__main__":
    apply_migration()
