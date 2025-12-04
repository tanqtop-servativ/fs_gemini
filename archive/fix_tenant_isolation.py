import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def fix_isolation():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Fixing Tenant Isolation...")

        # 1. Tables with direct tenant_id
        DIRECT_TENANT_TABLES = [
            "properties", "people", "roles", "service_jobs", 
            "job_templates", "bom_templates"
        ]
        
        for table in DIRECT_TENANT_TABLES:
            print(f"  - Locking down {table} (Direct)...")
            drop_permissive_policies(cur, table)
            create_policy(cur, table, "tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())")

        # 2. Tables via property_id
        PROPERTY_CHILD_TABLES = [
            "property_assignments", "property_access_codes", "calendar_feeds", 
            "property_inventory", "property_reference_photos", "property_attachments", "bookings"
        ]
        
        for table in PROPERTY_CHILD_TABLES:
            print(f"  - Locking down {table} (Via Property)...")
            drop_permissive_policies(cur, table)
            create_policy(cur, table, "property_id IN (SELECT id FROM properties WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))")

        # 3. Tables via role_id
        print(f"  - Locking down person_roles (Via Role)...")
        drop_permissive_policies(cur, "person_roles")
        create_policy(cur, "person_roles", "role_id IN (SELECT id FROM roles WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))")

        # 4. Tables via job_template_id (template_id)
        print(f"  - Locking down job_template_tasks (Via Job Template)...")
        drop_permissive_policies(cur, "job_template_tasks")
        create_policy(cur, "job_template_tasks", "template_id IN (SELECT id FROM job_templates WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))")

        # 5. Tables via bom_template_id (template_id)
        print(f"  - Locking down bom_template_items (Via BOM Template)...")
        drop_permissive_policies(cur, "bom_template_items")
        create_policy(cur, "bom_template_items", "template_id IN (SELECT id FROM bom_templates WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))")

        conn.commit()
        print("✅ Tenant Isolation enforced successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

def drop_permissive_policies(cur, table):
    policies = [
        "Allow All", "Enable All Access for Properties", "Enable All Access for Roles",
        "Enable All Access for Assignments", "Enable All Access for People",
        "Enable All Access for Person Roles", "Enable All Access for BOM Templates",
        "Enable All Access for BOM Items", "Enable All Access for Inventory",
        "Allow All Refs", "Allow All Templates", "Allow All Tasks",
        "Enable all access for anon", "Tenant Isolation"
    ]
    for p in policies:
        cur.execute(f'DROP POLICY IF EXISTS "{p}" ON {table}')

def create_policy(cur, table, condition):
    # 1. Tenant Isolation
    cur.execute(f"""
        CREATE POLICY "Tenant Isolation" ON {table}
        FOR ALL
        USING ({condition})
        WITH CHECK ({condition});
    """)
    
    # 2. Superuser Bypass (Ensure it exists)
    cur.execute(f'DROP POLICY IF EXISTS "Superuser Bypass" ON {table}')
    cur.execute(f"""
        CREATE POLICY "Superuser Bypass" ON {table}
        FOR ALL
        USING (is_admin() = true)
        WITH CHECK (is_admin() = true);
    """)

if __name__ == "__main__":
    fix_isolation()
