import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_schema():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("--- jobs ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'jobs'")
        for col in cur.fetchall():
            print(f"{col[0]}: {col[1]}")

        print("\n--- bookings ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bookings'")
        for col in cur.fetchall():
            print(f"{col[0]}: {col[1]}")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_schema()
