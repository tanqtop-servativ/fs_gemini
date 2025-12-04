import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def migrate():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Adding job_template_id to service_workflow_steps...")

        # 1. Add Column
        cur.execute("""
            ALTER TABLE service_workflow_steps 
            ADD COLUMN IF NOT EXISTS job_template_id BIGINT REFERENCES job_templates(id);
        """)
        
        # 2. Link "Deep Cleaning" step to "Cleaning" template
        # Find Cleaning Template
        cur.execute("SELECT id FROM job_templates WHERE name ILIKE '%Cleaning%' LIMIT 1")
        cleaning_tmpl = cur.fetchone()
        print(f"DEBUG: cleaning_tmpl = {cleaning_tmpl}")
        
        if cleaning_tmpl:
            tmpl_id = cleaning_tmpl[0]
            print(f"   Linking 'Deep Cleaning' steps to Template ID {tmpl_id}...")
            cur.execute("""
                UPDATE service_workflow_steps 
                SET job_template_id = %s 
                WHERE step_name ILIKE '%%Cleaning%%'
            """, (tmpl_id,))
        else:
            print("⚠️ Cleaning template not found, skipping data migration.")

        conn.commit()
        print("✅ Migration successful.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    migrate()
