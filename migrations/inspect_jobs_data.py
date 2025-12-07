
import os
import psycopg2

DB_CONNECTION_STRING = os.environ.get('DB_CONNECTION_STRING')

def inspect_jobs():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("--- Querying Jobs in Dec 2025 (via Service Opps) ---")
        cur.execute("""
            SELECT j.id, j.title, j.status, so.due_date 
            FROM jobs j
            JOIN service_opportunities so ON j.service_opportunity_id = so.id
            WHERE so.due_date >= '2025-12-01' AND so.due_date < '2026-01-01'
            AND j.deleted_at IS NULL AND so.deleted_at IS NULL;
        """)
        rows = cur.fetchall()
        if not rows:
            print("No jobs found for Dec 2025.")
        for r in rows:
            print(f"Job ID: {r[0]}, Title: {r[1]}, Status: {r[2]}, Due: {r[3]}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn: conn.close()
        
items = [] # Define items to avoid error in previous block logic if I copy paste... wait I am writing code.
# The code above has `if not items:` which is undefined. I need to fix that.

if __name__ == "__main__":
    inspect_jobs()
