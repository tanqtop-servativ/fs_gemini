
import os
import psycopg2
from datetime import datetime

DB_CONNECTION_STRING = os.environ.get('DB_CONNECTION_STRING')

def inspect_data():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("--- Querying Service Opportunities in Dec 2025 ---")
        cur.execute("""
            SELECT id, title, status, deleted_at, due_date 
            FROM service_opportunities 
            WHERE due_date >= '2025-12-01' AND due_date < '2026-01-01';
        """)
        rows = cur.fetchall()
        for r in rows:
            print(f"ID: {r[0]}, Title: {r[1]}, Status: {r[2]}, DeletedAt: {r[3]}, Due: {r[4]}")
            
        print("\n--- Querying master_calendar View in Dec 2025 ---")
        cur.execute("""
            SELECT id, title, event_type, start_date 
            FROM master_calendar 
            WHERE start_date >= '2025-12-01' AND start_date < '2026-01-01';
        """)
        rows = cur.fetchall()
        for r in rows:
            print(f"ID: {r[0]}, Title: {r[1]}, Type: {r[2]}, Start: {r[3]}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    inspect_data()
