import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_column():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Adding 'property_id' to service_opportunities...")
        
        # 1. Add Column
        cur.execute("""
            ALTER TABLE service_opportunities 
            ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);
        """)
        
        # 2. Add Index (Good practice)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_service_opps_property_id 
            ON service_opportunities(property_id);
        """)
        
        conn.commit()
        print("✅ Column added successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_column()
