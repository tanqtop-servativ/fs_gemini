
import os
import json
from supabase import create_client, Client

def test_rpc():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        print("Missing Supabase credentials")
        return

    supabase: Client = create_client(url, key)

    # 1. Get a user to simulate auth (we need a valid user ID for auth.uid() in the RPC)
    # Using service key allows bypassing RLS, but the RPC uses auth.uid().
    # Actually, SECURITY DEFINER RPCs run with owner permissions, BUT auth.uid() returns the calling user.
    # If called via Service Key, auth.uid() might be null or special.
    # To test properly, we should maybe sign in as a user? Or assume the RPC handles service key?
    # The RPC says: `SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = auth.uid();`
    # If auth.uid() is null, it raises 'User not associated with a tenant'.
    
    # We can fake a login or assume we have a test user.
    # Let's try to list users and sign in? Or just use a known UID if we can mocking it?
    # We can't mock auth.uid() easily from outside without a valid token.
    
    # Alternative: Temporarily modify the RPC to accept tenant_id for testing? No, that invalidates the test.
    
    # Valid Approach: Log in as a test user. Do we have one?
    # I'll check `auth.users` via SQL first to find a user, then try to invoke the RPC *impersonating* that user 
    # OR (easier) I'll manually run SQL to call the function with a specific context?
    # `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '...';`
    
    # I'll use a SQL script with `psycopg2` to simulate the environment fully.
    pass

import psycopg2

def test_sql_rpc():
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v.strip().strip("'").strip('"')
    except: pass
    
    conn_str = os.environ.get('DB_CONNECTION_STRING') or env_vars.get('DB_CONNECTION_STRING')
    if not conn_str: return print("No connection string")
    conn_str = conn_str.strip("'").strip('"')

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # Find a user with a profile and tenant
        cur.execute("SELECT id, tenant_id FROM profiles LIMIT 1;")
        user = cur.fetchone()
        if not user:
            print("No users found in profiles.")
            return
        
        user_id, tenant_id = user
        print(f"Testing as User: {user_id}, Tenant: {tenant_id}")

        # tasks payload
        tasks = [
            {
                "title": "Test Task 1", 
                "description": "Desc 1", 
                "checklist": [
                    {"description": "Check 1", "item_type": "simple"},
                    {"description": "Input 1", "item_type": "input"}
                ]
            }
        ]
        
        try:
            # Simulate Auth Context
            # We need to set the config variables that `auth.uid()` reads.
            # In Supabase/PostgREST, these are `request.jwt.claim.sub`.
            cur.execute(f"SET request.jwt.claim.sub = '{user_id}';")
            cur.execute("SET ROLE authenticated;")
            
            # Call RPC
            cur.callproc('create_job_template', [
                'RPC Test Job',
                'RPC Description',
                'RPC Spanish',
                'RPC Spanish Desc',
                json.dumps(tasks)
            ])
            
            job_id = cur.fetchone()[0]
            print(f"Successfully created Job Template: {job_id}")
            
            # Verify checklist items
            # We need to switch back to postgres/service role to query tables if RLS blocks us?
            # Or just query assuming we are the user (RLS should allow viewing own data).
            
            cur.execute(f"SELECT count(*) FROM job_template_checklist_items WHERE job_template_task_id IN (SELECT id FROM job_template_tasks WHERE job_template_id = '{job_id}')")
            count = cur.fetchone()[0]
            print(f"Checklist items created: {count}")
            
            conn.commit()
            
        except Exception as e:
            print(f"RPC Call Failed: {e}")
            conn.rollback()

        cur.close(); conn.close()
    except Exception as e: print(e)

if __name__ == '__main__': test_sql_rpc()
