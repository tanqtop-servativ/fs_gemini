import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def check_schema():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'service_opportunities'
        """)
        columns = [col[0] for col in cur.fetchall()]
        print(f"Columns: {columns}")
        
        if 'deleted_at' in columns:
            print("✅ deleted_at column exists.")
        else:
            print("❌ deleted_at column MISSING.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
