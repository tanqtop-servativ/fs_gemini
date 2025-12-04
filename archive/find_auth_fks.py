import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def find_fks():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Finding Foreign Keys referencing auth.users...")
        
        query = """
        SELECT 
            conrelid::regclass AS table_name, 
            a.attname AS column_name, 
            confrelid::regclass AS foreign_table_name,
            confdeltype
        FROM 
            pg_constraint AS c 
            JOIN pg_attribute AS a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        WHERE 
            confrelid = 'auth.users'::regclass;
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        for row in rows:
            # confdeltype: 'a' = no action, 'r' = restrict, 'c' = cascade, 'n' = set null, 'd' = set default
            action_map = {'a': 'NO ACTION', 'r': 'RESTRICT', 'c': 'CASCADE', 'n': 'SET NULL', 'd': 'SET DEFAULT'}
            action = action_map.get(row[3], row[3])
            print(f"   Table: {row[0]} | Column: {row[1]} | On Delete: {action}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    find_fks()
