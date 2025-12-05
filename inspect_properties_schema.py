import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_properties_schema():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        tables = ['property_access_codes', 'property_inventory', 'calendar_feeds', 'property_assignments']
        for table in tables:
            cur.execute(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{table}'
                ORDER BY ordinal_position;
            """)
            columns = cur.fetchall()
            print(f"--- {table} Schema ({len(columns)} columns) ---")
            for col in columns:
                print(f"{col[0]}: {col[1]}")
            print("-" * 40)
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    inspect_properties_schema()
