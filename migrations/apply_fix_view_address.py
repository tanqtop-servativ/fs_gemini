
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def apply():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        with open("migrations/fix_properties_view_address.sql", "r") as f:
            sql = f.read()
            
        print("Applying migration...")
        cur.execute(sql)
        conn.commit()
        print("✅ Migration applied successfully.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    apply()
