import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def activate_tenant():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Reactivating Tenant 1...")
        
        cur.execute("UPDATE tenants SET is_active = true WHERE id = 1")
        
        if cur.rowcount > 0:
            print("✅ Tenant 1 ('My Property Biz') is now ACTIVE.")
        else:
            print("⚠️ Tenant 1 not found.")

        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    activate_tenant()
