import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DB_CONNECTION_STRING')
if not db_url:
    print("Error: DB_CONNECTION_STRING not found")
    sys.exit(1)

# List of tables to secure
tables = [
    "bookings",
    "calendar_feeds",
    "job_inputs",
    "job_template_inputs",
    "job_templates",
    "roles",
    "service_jobs",
    "standard_line_items"
]

sql_commands = []

# 1. Helper Function (Security Definer to safely read profiles)
sql_commands.append("""
CREATE OR REPLACE FUNCTION get_auth_tenant_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$;
""")

# 2. Profiles Table Strategy
# Need specific handling because it's the source of truth
sql_commands.append("ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;")
sql_commands.append("DROP POLICY IF EXISTS \"Users can manage own profile\" ON profiles;")
sql_commands.append("""
CREATE POLICY "Users can manage own profile" ON profiles
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
""")
sql_commands.append("DROP POLICY IF EXISTS \"View same tenant profiles\" ON profiles;")
sql_commands.append("""
CREATE POLICY "View same tenant profiles" ON profiles
    FOR SELECT
    USING (tenant_id = get_auth_tenant_id());
""")

# 3. Standard Tables Strategy
for table in tables:
    sql_commands.append(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
    
    # Drop existing if any (to be safe/idempotent)
    sql_commands.append(f"DROP POLICY IF EXISTS \"Tenant Isolation\" ON {table};")
    
    # Create Policy
    # "USING" determines which existing rows are visible/modifiable
    # "WITH CHECK" determines validity of new/updated rows
    sql_commands.append(f"""
    CREATE POLICY "Tenant Isolation" ON {table}
        USING (tenant_id = get_auth_tenant_id())
        WITH CHECK (tenant_id = get_auth_tenant_id());
    """)

full_sql = "\n".join(sql_commands)

print("Executing SQL migration...")
try:
    # Use psql to execute the batch
    result = subprocess.run(['psql', db_url, '-f', '-'], input=full_sql, text=True, capture_output=True, check=True)
    print("Success!")
    print(result.stdout)
except subprocess.CalledProcessError as e:
    print("Migration Failed!")
    print(e.stderr)
