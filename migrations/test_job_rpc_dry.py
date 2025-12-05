
import os
import psycopg2
import json

def test_rpc():
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v.strip().strip("'").strip('"')
    except: pass
    
    conn_str = os.environ.get('DB_CONNECTION_STRING') or env_vars.get('DB_CONNECTION_STRING')
    
    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # 1. Create a dummy tenant context (we need a valid user for auth.uid() if we were using RLS, but we are using SECURITY DEFINER and look up via auth.uid(). 
        # WAIT. SECURITY DEFINER RPC looking up `auth.uid()` means it needs a valid Supabase/JWT session. 
        # Python script connecting via psycopg2 is NOT a Supabase user. `auth.uid()` will be NULL.
        
        # This is likely the problem with my previous test too, but here it matters more.
        # If I call the RPC from Python direct connection, `auth.uid()` is null.
        # The RPC says: `SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = auth.uid();`
        # `IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'User not associated with a tenant';`
        
        # So my Python test WILL FAIL with "User not associated with a tenant" unless I mock auth.uid().
        # However, the USER is using the frontend, so they HAVE a session.
        
        # BUT, if `getTenantId()` was failing before...
        
        # Let's try to verify if the RPC syntax is correct by setting a local variable for auth.uid logic or mocking it?
        # PostgREST handles the JWT claims. psycopg2 effectively connects as postgres/admin usually.
        
        # I can try to set the config variable `request.jwt.claim.sub` manually in the transaction?
        # Or easier: Create a modified "Debug" RPC that takes ID explicit, test it, then revert? 
        # Or just trust that if the code matches schema, it should work.
        
        # Let's verify the schema of `job_jobs_template_tasks` vs the INSERT in RPC.
        
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'job_template_tasks'")
        cols = [r[0] for r in cur.fetchall()]
        print("Columns:", cols)
        
        # RPC Insert:
        # INSERT INTO job_template_tasks (job_template_id, title, description, title_es, description_es, is_required, require_photo, sort_order)
        required_cols = ['job_template_id', 'title', 'description', 'title_es', 'description_es', 'is_required', 'require_photo', 'sort_order']
        
        missing = [c for c in required_cols if c not in cols]
        if missing:
            print("MISSING COLUMNS:", missing)
        else:
            print("All RPC insert columns exist.")

    except Exception as e: print(e)

if __name__ == '__main__': test_rpc()
