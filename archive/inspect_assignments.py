import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'property_assignments';
    """)
    
    columns = cur.fetchall()
    print("Columns in property_assignments:")
    for col in columns:
        print(col)
        
    cur.execute("""
        SELECT
            tc.constraint_name, 
            tc.constraint_type
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'property_assignments';
    """)
    
    constraints = cur.fetchall()
    print("\nConstraints:")
    for c in constraints:
        print(c)

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
