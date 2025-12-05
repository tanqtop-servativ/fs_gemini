import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_function():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔍 Inspecting save_person_safe function...")
        
        # Get function arguments
        cur.execute("""
            SELECT pg_get_function_arguments('save_person_safe'::regproc);
        """)
        args = cur.fetchone()
        if args:
            print(f"Arguments: {args[0]}")
        else:
            print("❌ Function save_person_safe NOT FOUND.")
            
        # Get function definition
        cur.execute("""
            SELECT pg_get_functiondef('save_person_safe'::regproc);
        """)
        defn = cur.fetchone()
        if defn:
            print("\nDefinition:")
            print(defn[0])
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_function()
