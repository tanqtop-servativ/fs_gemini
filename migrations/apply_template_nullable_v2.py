
import os
import sys
from supabase import create_client

def apply_migration():
    # Helper to load .env manually
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    # Remove quotes if present
                    val = val.strip().strip("'").strip('"')
                    env_vars[key] = val
    except Exception as e:
        print(f"Failed to read .env: {e}")

    url = os.environ.get("SUPABASE_URL") or env_vars.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or env_vars.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("Missing credentials.")
        return

    print(f"Connecting to: {url}")
    
    try:
        container = create_client(url, key)
    except Exception as e:
        print(f"Client creation failed: {e}")
        return

    sql = """
    ALTER TABLE service_opportunities ALTER COLUMN service_template_id DROP NOT NULL;
    """
    
    try:
        # Try generic rpc exec_sql
        res = container.rpc('exec_sql', {'sql_query': sql}).execute()
        print("Migration applied via exec_sql")
    except Exception as e:
        print(f"RPC exec_sql failed, trying direct REST SQL might not work but let's see error: {e}")
        # Could try to use a different method if this fails, but usually exec_sql is the way for our setup.

if __name__ == "__main__":
    apply_migration()
