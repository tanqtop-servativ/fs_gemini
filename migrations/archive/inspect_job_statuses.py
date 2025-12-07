
import os
import psycopg2

DB_CONNECTION_STRING = os.environ.get('DB_CONNECTION_STRING')

def inspect_statuses():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT status FROM jobs")
        rows = cur.fetchall()
        print(f"Distinct Job Statuses: {[r[0] for r in rows]}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    inspect_statuses()
