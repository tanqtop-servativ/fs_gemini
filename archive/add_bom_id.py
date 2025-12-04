import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_column():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Adding bom_id to job_templates...")
        cur.execute("""
            ALTER TABLE job_templates 
            ADD COLUMN IF NOT EXISTS bom_id INTEGER REFERENCES bom_templates(id);
        """)
        
        conn.commit()
        print("✅ Column bom_id added successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_column()
