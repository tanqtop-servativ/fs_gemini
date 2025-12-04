import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def seed_tasks():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🌱 Seeding Task Templates...")

        # 1. Find Cleaning Template
        cur.execute("SELECT id FROM job_templates WHERE name ILIKE '%Cleaning%' LIMIT 1")
        result = cur.fetchone()
        
        if not result:
            print("❌ 'Cleaning' Job Template not found. Please seed job templates first.")
            return

        cleaning_id = result[0]
        print(f"   Found Cleaning Template ID: {cleaning_id}")

        # 2. Insert Tasks
        tasks = [
            (cleaning_id, 1, 'Wipe Kitchen Counters', 'Use disinfectant spray.', 'checkbox', 1),
            (cleaning_id, 1, 'Vacuum Living Room', 'Ensure under the sofa is cleaned.', 'checkbox', 2),
            (cleaning_id, 1, 'Check Thermostat', 'Set to 72 degrees.', 'number', 3),
            (cleaning_id, 1, 'Upload After Photo', 'Take a photo of the living room.', 'photo', 4)
        ]

        cur.executemany("""
            INSERT INTO task_templates (job_template_id, tenant_id, title, description, input_type, order_index)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, tasks)
        
        conn.commit()
        print(f"✅ Seeded {len(tasks)} tasks.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    seed_tasks()
