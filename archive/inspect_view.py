import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    cur.execute("select pg_get_viewdef('properties_enriched', true)")
    view_def = cur.fetchone()[0]
    
    print("--- View Definition: properties_enriched ---")
    print(view_def)

except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
