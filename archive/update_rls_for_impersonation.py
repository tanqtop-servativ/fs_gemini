import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

# List of tables that have tenant_id and need RLS update
TENANT_TABLES = [
    "properties",
    "jobs",
    "service_opportunities",
    "people",
    "job_templates",
    "bom_templates",
    "calendar_feeds",
    "property_inventory",
    "property_attachments",
    "property_reference_photos",
    "property_assignments",
    "person_roles",
    "job_template_tasks",
    "bom_template_items",
    "property_access_codes"
]

def update_rls():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Updating RLS policies for Tenant Impersonation...")
        
        # 1. Update Tenant Tables
        for table in TENANT_TABLES:
            print(f"  - Processing {table}...")
            
            # We need to find the existing policy name or just drop/create a standard one.
            # Let's assume a standard name "Tenant Isolation" or similar, but safer to just drop and recreate our own.
            # However, we don't know the exact name.
            # Strategy: Create a NEW policy "Superuser Access" that allows everything for superusers?
            # Postgres policies are OR'd together (permissive).
            # So if we add a policy "Allow Superuser" -> USING ( (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true )
            # That should work! We don't need to modify the existing "Tenant Isolation" policy.
            # If "Tenant Isolation" says "Only my tenant", and "Superuser Access" says "Superusers allowed", 
            # then a Superuser gets access via the second policy.
            
            policy_name = "Superuser Bypass"
            
            # Drop if exists
            cur.execute(f'DROP POLICY IF EXISTS "{policy_name}" ON {table}')
            
            # Create new policy
            # Note: We need to join with profiles to check is_superuser
            cur.execute(f"""
                CREATE POLICY "{policy_name}" ON {table}
                FOR ALL
                USING (
                    (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
                )
                WITH CHECK (
                    (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
                );
            """)
            
        # 2. Update Tenants Table (to allow listing)
        print("  - Processing tenants table...")
        cur.execute('ALTER TABLE tenants ENABLE ROW LEVEL SECURITY')
        cur.execute('DROP POLICY IF EXISTS "Allow Public Read" ON tenants') # Cleanup old if any
        cur.execute('DROP POLICY IF EXISTS "Superuser Bypass" ON tenants')
        
        # Allow Superusers to see ALL tenants
        cur.execute("""
            CREATE POLICY "Superuser Bypass" ON tenants
            FOR ALL
            USING (
                (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
            )
        """)
        
        # Allow Users to see THEIR OWN tenant (for display names etc)
        # Assuming users have a tenant_id in profiles
        cur.execute('DROP POLICY IF EXISTS "View Own Tenant" ON tenants')
        cur.execute("""
            CREATE POLICY "View Own Tenant" ON tenants
            FOR SELECT
            USING (
                id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
            )
        """)

        # 3. Update Profiles Table (to allow seeing other profiles if superuser)
        print("  - Processing profiles table...")
        cur.execute('DROP POLICY IF EXISTS "Superuser Bypass" ON profiles')
        cur.execute("""
            CREATE POLICY "Superuser Bypass" ON profiles
            FOR ALL
            USING (
                (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
            )
        """)
        
        conn.commit()
        print("✅ RLS policies updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    update_rls()
