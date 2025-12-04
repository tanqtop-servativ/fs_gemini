import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def seed_data():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🌱 Seeding Service Templates...")

        # 1. Create "Airbnb Turnaround" Template
        cur.execute("""
            INSERT INTO service_templates (tenant_id, name, description)
            VALUES (1, 'Airbnb Turnaround', 'Full turnover service including kitting, cleaning, and inspection.')
            RETURNING id;
        """)
        template_id = cur.fetchone()[0]
        print(f"   Created Template: Airbnb Turnaround (ID: {template_id})")

        # 2. Create Workflow Steps
        # Step 1: Kitting (Backoffice)
        cur.execute("""
            INSERT INTO service_workflow_steps (service_template_id, step_name, job_type, is_field_job, order_index)
            VALUES (%s, 'Initial Kitting', 'Kitting', FALSE, 1)
            RETURNING id;
        """, (template_id,))
        kitting_id = cur.fetchone()[0]

        # Step 2: Cleaning (Field) - Depends on Kitting? Maybe not strictly, but let's say yes for demo.
        # Actually, usually Kitting happens before or parallel. Let's make Cleaning depend on Kitting just to show dependency.
        cur.execute("""
            INSERT INTO service_workflow_steps (service_template_id, step_name, job_type, is_field_job, depends_on_step_id, order_index)
            VALUES (%s, 'Deep Cleaning', 'Field', TRUE, %s, 2)
            RETURNING id;
        """, (template_id, kitting_id))
        cleaning_id = cur.fetchone()[0]

        # Step 3: Inspection (Field) - Depends on Cleaning
        cur.execute("""
            INSERT INTO service_workflow_steps (service_template_id, step_name, job_type, is_field_job, depends_on_step_id, order_index)
            VALUES (%s, 'Quality Inspection', 'Inspection', TRUE, %s, 3)
            RETURNING id;
        """, (template_id, cleaning_id))
        inspection_id = cur.fetchone()[0]

        # Step 4: Invoice (Backoffice) - Depends on Inspection
        cur.execute("""
            INSERT INTO service_workflow_steps (service_template_id, step_name, job_type, is_field_job, depends_on_step_id, order_index)
            VALUES (%s, 'Generate Invoice', 'Invoice', FALSE, %s, 4)
            RETURNING id;
        """, (template_id, inspection_id))
        invoice_id = cur.fetchone()[0]

        conn.commit()
        print("✅ Seeding complete.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    seed_data()
