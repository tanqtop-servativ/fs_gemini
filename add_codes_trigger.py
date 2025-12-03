import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

sql = """
DROP TRIGGER IF EXISTS audit_codes_trigger ON property_access_codes;

CREATE TRIGGER audit_codes_trigger
AFTER INSERT OR UPDATE OR DELETE ON property_access_codes
FOR EACH ROW EXECUTE FUNCTION record_audit_log();
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Adding audit trigger to 'property_access_codes'...")
    cur.execute(sql)
    conn.commit()
    print("✅ Trigger added successfully.")
            
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
