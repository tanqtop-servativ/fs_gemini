import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_tasks_table():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        query = """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'job_template_tasks';
        """
        cur.execute(query)
        results = cur.fetchall()
        print("Columns in job_template_tasks:")
        for row in results:
            print(f" - {row[0]}: {row[1]}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    inspect_tasks_table()
