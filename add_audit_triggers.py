import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

TABLES_TO_AUDIT = [
    "jobs",
    "service_opportunities",
    "job_templates",
    "job_template_tasks",
    "calendar_feeds",
    "property_inventory",
    "property_attachments",
    "property_reference_photos",
    "property_assignments",
    "bom_template_items",
    "person_roles"
]

def add_audit_triggers():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Adding audit triggers to tables...")
        
        for table in TABLES_TO_AUDIT:
            trigger_name = f"audit_{table}_trigger"
            print(f"  - Processing {table}...")
            
            # Drop existing trigger to be safe/idempotent
            cur.execute(f"DROP TRIGGER IF EXISTS {trigger_name} ON {table};")
            
            # Create Trigger
            cur.execute(f"""
                CREATE TRIGGER {trigger_name}
                AFTER INSERT OR UPDATE OR DELETE ON {table}
                FOR EACH ROW EXECUTE FUNCTION record_audit_log();
            """)
            
        conn.commit()
        print("✅ All audit triggers added successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_audit_triggers()
