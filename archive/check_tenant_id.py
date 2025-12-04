import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def check_tenant_ids():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()

        print("Checking for tenant_id columns in all public tables...")
        
        cur.execute("""
            SELECT 
                t.table_name,
                EXISTS (
                    SELECT 1 
                    FROM information_schema.columns c 
                    WHERE c.table_name = t.table_name 
                    AND c.column_name = 'tenant_id'
                ) as has_tenant_id
            FROM information_schema.tables t
            WHERE t.table_schema = 'public' 
            AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name;
        """)
        
        tables = cur.fetchall()
        
        print("\nTables with tenant_id:")
        print("-" * 30)
        for table, has_id in tables:
            if has_id:
                print(f"✅ {table}")
                
        print("\nTables WITHOUT tenant_id:")
        print("-" * 30)
        for table, has_id in tables:
            if not has_id:
                print(f"❌ {table}")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_tenant_ids()
