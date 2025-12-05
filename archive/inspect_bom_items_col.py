import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_cols():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        query = """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'bom_template_items';
        """
        cur.execute(query)
        results = cur.fetchall()
        print("Columns in bom_template_items:")
        for row in results:
            print(f" - {row[0]}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    inspect_cols()
