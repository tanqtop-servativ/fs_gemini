
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
        
        # Test calling with invalid UUID (we can't pass int directly to function expecting uuid in raw SQL easily without cast)
        # But Supabase (PostgREST) receives JSON and tries to cast. 
        # Here we simulate what happens if we try to invoke it with a string/text that IS valid UUID vs not.
        
        # This checks if the FUNCTION exists and accepts params
        # We'll try to call it with a proper UUID first to prove it works
        
        print("Testing with VALID UUID:")
        # We need a valid tenant UUID. fetching one.
        cur.execute("SELECT id FROM tenants LIMIT 1")
        tenant_id = cur.fetchone()[0]
        print(f"Using tenant_id: {tenant_id}")
        
        try:
             cur.callproc('create_job_template', [
                 'Test Template Python', 
                 'Desc', 
                 'Test ES', 
                 'Desc ES', 
                 json.dumps([]), 
                 tenant_id
             ])
             print("Success with valid UUID")
             conn.rollback() # Don't actually save
        except Exception as e:
            print("Error with valid UUID:", e)
            conn.rollback()

    except Exception as e: print(e)

if __name__ == '__main__': test_rpc()
