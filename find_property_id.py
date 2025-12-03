import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
SELECT id, name FROM properties WHERE name ILIKE '%Ellahie%';
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    cur.execute(sql)
    rows = cur.fetchall()
    
    if not rows:
        print("❌ Property 'Ellahie' not found.")
    else:
        for row in rows:
            print(f"Property: {row[1]} (ID: {row[0]})")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
