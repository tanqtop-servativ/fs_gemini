import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_functions():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT proname, proargtypes::regtype[], prosrc 
            FROM pg_proc 
            WHERE proname = 'generate_service_workflow';
        """)
        
        results = cur.fetchall()
        print(f"Found {len(results)} functions:")
        for name, args, src in results:
            print(f"--- {name}({args}) ---")
            print(src[:200] + "...") # Print first 200 chars of source
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_functions()
