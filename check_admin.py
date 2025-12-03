import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = "SELECT email, is_superuser FROM app_users WHERE email = 'admin@example.com';"

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Checking admin user...")
    cur.execute(sql)
    row = cur.fetchone()
    
    if row:
        print(f"User: {row[0]}, Superuser: {row[1]}")
    else:
        print("❌ Admin user not found.")
            
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'conn' in locals() and conn:
        conn.close()
