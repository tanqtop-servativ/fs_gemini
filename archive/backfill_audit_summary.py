import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def backfill_audit_summary():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()

        print("Backfilling audit_logs record_summary...")
        
        # We can use a single UPDATE statement with a CASE expression, similar to the trigger logic.
        # We prioritize NEW values (for INSERT/UPDATE), then OLD values (for DELETE).
        # Note: new_values/old_values are JSONB.
        
        cur.execute("""
            UPDATE audit_logs
            SET record_summary = CASE
                WHEN table_name = 'people' THEN 
                    COALESCE(new_values->>'first_name', old_values->>'first_name') || ' ' || COALESCE(new_values->>'last_name', old_values->>'last_name')
                WHEN table_name IN ('properties', 'tenants', 'bom_templates', 'job_templates', 'roles') THEN 
                    COALESCE(new_values->>'name', old_values->>'name')
                WHEN table_name = 'app_users' THEN 
                    COALESCE(new_values->>'email', old_values->>'email')
                WHEN table_name = 'property_attachments' THEN 
                    COALESCE(new_values->>'file_name', old_values->>'file_name')
                WHEN table_name = 'property_reference_photos' THEN 
                    COALESCE(new_values->>'label', old_values->>'label', 'Photo')
                ELSE NULL
            END
            WHERE record_summary IS NULL;
        """)

        conn.commit()
        print(f"✅ Backfill complete. Updated {cur.rowcount} rows.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    backfill_audit_summary()
