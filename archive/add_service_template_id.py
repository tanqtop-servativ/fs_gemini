import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_column():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Adding service_template_id to service_opportunities...")
        cur.execute("""
            ALTER TABLE service_opportunities 
            ADD COLUMN IF NOT EXISTS service_template_id BIGINT REFERENCES service_templates(id);
        """)
        
        conn.commit()
        print("✅ Column added successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_column()
