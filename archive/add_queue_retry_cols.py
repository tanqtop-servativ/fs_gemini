import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_columns():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Adding retry columns to job_queue...")
        
        # Add max_attempts
        cur.execute("""
            ALTER TABLE job_queue 
            ADD COLUMN IF NOT EXISTS max_attempts INTEGER DEFAULT 3;
        """)
        
        # Add attempts
        cur.execute("""
            ALTER TABLE job_queue 
            ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;
        """)
        
        # Add run_after
        cur.execute("""
            ALTER TABLE job_queue 
            ADD COLUMN IF NOT EXISTS run_after TIMESTAMPTZ DEFAULT NOW();
        """)

        # Add priority
        cur.execute("""
            ALTER TABLE job_queue 
            ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
        """)
        
        # Add index for efficient fetching
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_job_queue_fetch 
            ON job_queue (status, run_after, priority DESC, created_at ASC);
        """)
        
        conn.commit()
        print("✅ Columns added successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_columns()
