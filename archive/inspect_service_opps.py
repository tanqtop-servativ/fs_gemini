import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_table():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting service_opportunities...")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'service_opportunities';
        """)
        columns = cur.fetchall()
        
        if not columns:
            print("❌ Table service_opportunities DOES NOT EXIST.")
        else:
            for col in columns:
                print(f"   {col[0]}: {col[1]}")
        
        # Check Foreign Keys
        print("\n🔍 Checking Foreign Keys:")
        cur.execute("""
            SELECT
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.key_column_usage AS kcu
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = kcu.constraint_name
            WHERE kcu.table_name = 'service_opportunities';
        """)
        fks = cur.fetchall()
        for fk in fks:
            print(f"   {fk[0]} -> {fk[1]}.{fk[2]}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_table()
