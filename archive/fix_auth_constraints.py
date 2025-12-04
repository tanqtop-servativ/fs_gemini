import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def fix_constraints():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔧 Fixing Foreign Key Constraints...")

        # 1. job_tasks.completed_by
        print("   Fixing job_tasks.completed_by...")
        cur.execute("""
            ALTER TABLE job_tasks 
            DROP CONSTRAINT job_tasks_completed_by_fkey,
            ADD CONSTRAINT job_tasks_completed_by_fkey 
            FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        """)

        # 2. job_inputs.provided_by
        print("   Fixing job_inputs.provided_by...")
        cur.execute("""
            ALTER TABLE job_inputs 
            DROP CONSTRAINT job_inputs_provided_by_fkey,
            ADD CONSTRAINT job_inputs_provided_by_fkey 
            FOREIGN KEY (provided_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        """)
        
        conn.commit()
        print("✅ Constraints updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_constraints()
