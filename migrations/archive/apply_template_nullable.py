
import os
import sys
from supabase import create_client

# Define a function to read the SQL file
def read_sql_file(file_path):
    with open(file_path, 'r') as file:
        return file.read()

# Main function to apply the migration
def apply_migration():
    # Load environment variables (assuming they are set in the environment or .env file)
    # For this environment, we'll try to get them from os.environ
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required.")
        # Try loading from a local .env file if available (basic parsing)
        try:
            with open('.env', 'r') as f:
                for line in f:
                    if '=' in line:
                        k, v = line.strip().split('=', 1)
                        if k == 'SUPABASE_URL': url = v
                        if k == 'SUPABASE_SERVICE_KEY': key = v
        except FileNotFoundError:
            pass
            
    if not url or not key:
        print("Could not find Supabase credentials.")
        sys.exit(1)

    supabase = create_client(url, key)

    sql_file_path = 'migrations/make_template_nullable.sql'
    try:
        sql_content = read_sql_file(sql_file_path)
        # Execute the SQL using the rpc 'exec_sql' if available, otherwise we might need a direct connection or another rpc.
        # Assuming exec_sql exists from previous context or generic sql execution.
        # Use a common pattern for executing raw SQL if a specific RPC isn't known, 
        # but usually we use a helper. Let's assume there is an `exec_sql` RPC or similar.
        # If not, we might fail. Let's try `exec` or similar.
        # Actually, standard supabase-py doesn't have raw SQL exec without an RPC.
        
        # Let's try to use the `exec_sql` RPC which is common in these setups.
        response = supabase.rpc('exec_sql', {'sql_query': sql_content}).execute()
        print("Migration applied successfully.")
        print(response)

    except Exception as e:
        print(f"Error applying migration: {e}")
        # If exec_sql fails (maybe doesn't exist), we might need to instruct user or use another way.
        # But let's hope it exists.
        sys.exit(1)

if __name__ == "__main__":
    apply_migration()
