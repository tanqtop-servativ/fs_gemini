import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def seed_inputs():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🌱 Seeding Job Inputs...")

        # 1. Find Cleaning Template
        cur.execute("SELECT id FROM job_templates WHERE name ILIKE '%Cleaning%' LIMIT 1")
        result = cur.fetchone()
        
        if not result:
            print("❌ 'Cleaning' Job Template not found.")
            return

        cleaning_id = result[0]
        print(f"   Found Cleaning Template ID: {cleaning_id}")

        # 2. Insert Inputs
        inputs = [
            (cleaning_id, 1, 'Before Photo', 'before_photo', 'photo', True),
            (cleaning_id, 1, 'Damage Report', 'damage_report', 'text', False)
        ]

        cur.executemany("""
            INSERT INTO job_template_inputs (job_template_id, tenant_id, label, key, input_type, is_required)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, inputs)
        
        conn.commit()
        print(f"✅ Seeded {len(inputs)} inputs for Kitting.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    seed_inputs()
