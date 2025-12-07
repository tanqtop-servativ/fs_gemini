
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def apply():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        with open("migrations/fix_job_queue_schema.sql", "r") as f:
            sql = f.read()
            
        print("Applying migration: fix_job_queue_schema.sql...")
        cur.execute(sql)
        conn.commit()
        print("✅ Migration applied successfully.")
        
        # Verify columns
        cur.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'job_queue' ORDER BY ordinal_position
        """)
        print("job_queue columns:", [r[0] for r in cur.fetchall()])
        
    except Exception as e:
        print(f"❌ Error: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    apply()
