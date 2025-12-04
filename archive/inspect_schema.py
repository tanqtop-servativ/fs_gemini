import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        
        print("--- TABLES ---")
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        for row in cur.fetchall():
            print(row[0])

        print("\n--- AUDIT_HISTORY_VIEW COLUMNS ---")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'audit_history_view';
        """)
        for row in cur.fetchall():
            print(f"{row[0]} ({row[1]})")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    inspect()
