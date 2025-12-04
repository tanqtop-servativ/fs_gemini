import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_columns():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        tables_to_check = ['bom_templates', 'job_templates', 'jobs', 'service_opportunities', 'properties', 'people', 'roles']
        
        print("🔍 Checking for 'deleted_at' column...")
        
        for table in tables_to_check:
            cur.execute(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '{table}' AND column_name = 'deleted_at';
            """)
            result = cur.fetchone()
            if result:
                print(f"✅ {table}: deleted_at EXISTS")
            else:
                print(f"❌ {table}: deleted_at MISSING")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_columns()
