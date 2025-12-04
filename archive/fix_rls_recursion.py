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

def fix_rls():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Fixing RLS Recursion...")

        # 1. Create Helper Function (Security Definer)
        # This function runs as the owner (postgres) and bypasses RLS
        print("  - Creating is_admin() function...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION public.is_admin()
            RETURNS boolean
            LANGUAGE sql
            SECURITY DEFINER
            SET search_path = public
            AS $$
              SELECT COALESCE(
                (SELECT is_superuser FROM profiles WHERE id = auth.uid()),
                false
              );
            $$;
        """)
        
        # Grant execute permission
        cur.execute("GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;")

        # 2. Update Tenant Tables
        for table in TENANT_TABLES:
            print(f"  - Updating {table}...")
            cur.execute(f'DROP POLICY IF EXISTS "Superuser Bypass" ON {table}')
            cur.execute(f"""
                CREATE POLICY "Superuser Bypass" ON {table}
                FOR ALL
                USING (is_admin() = true)
                WITH CHECK (is_admin() = true);
            """)
            
        # 3. Update Tenants Table
        print("  - Updating tenants table...")
        cur.execute('DROP POLICY IF EXISTS "Superuser Bypass" ON tenants')
        cur.execute("""
            CREATE POLICY "Superuser Bypass" ON tenants
            FOR ALL
            USING (is_admin() = true)
        """)

        # 4. Update Profiles Table (The culprit!)
        print("  - Updating profiles table...")
        cur.execute('DROP POLICY IF EXISTS "Superuser Bypass" ON profiles')
        cur.execute("""
            CREATE POLICY "Superuser Bypass" ON profiles
            FOR ALL
            USING (is_admin() = true)
        """)
        
        conn.commit()
        print("✅ RLS policies fixed successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_rls()
