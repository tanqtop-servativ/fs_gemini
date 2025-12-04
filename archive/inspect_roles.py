import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_roles():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # Get columns
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'roles';
        """)
        columns = cur.fetchall()
        print("Columns:")
        for col in columns:
            print(col)
            
        # Get existing roles
        cur.execute("SELECT * FROM roles LIMIT 10;")
        rows = cur.fetchall()
        print("\nSample Data:")
        for row in rows:
            print(row)
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_roles()
