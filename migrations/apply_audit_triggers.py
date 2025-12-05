import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.getcwd(), '.env'))

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def apply_triggers():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Applying Audit Triggers...")
        
        # List of tables to audit
        tables = [
            'tenants',
            'roles',
            'people',
            'properties',
            'jobs',
            'service_opportunities',
            'service_templates',
            'job_templates',
            'bom_templates',
            'property_assignments',
            'person_roles'
        ]
        
        for table in tables:
            print(f"   Processing {table}...")
            
            # Drop existing trigger if any (to be safe)
            cur.execute(f"DROP TRIGGER IF EXISTS audit_trigger ON {table};")
            
            # Create Trigger
            cur.execute(f"""
                CREATE TRIGGER audit_trigger
                AFTER INSERT OR UPDATE OR DELETE ON {table}
                FOR EACH ROW EXECUTE FUNCTION record_audit_log();
            """)
            print(f"   ✅ Trigger applied to {table}")
        
        conn.commit()
        print("🎉 All triggers applied successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    apply_triggers()
