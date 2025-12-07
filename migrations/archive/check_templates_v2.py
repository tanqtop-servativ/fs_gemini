
import os
import psycopg2

def check_structure():
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'): continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    val = val.strip().strip("'").strip('"')
                    env_vars[key] = val
    except: pass
    
    conn_str = os.environ.get('DB_CONNECTION_STRING') or env_vars.get('DB_CONNECTION_STRING')
    if not conn_str: return print("No connection string")
    
    # Strip quotes if they were accidentally included in the var itself
    conn_str = conn_str.strip("'").strip('"')

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # Check tables
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        tables = [r[0] for r in cur.fetchall()]
        print("Tables:", tables)
        
        if 'service_templates' in tables:
            print("\nColumns in service_templates:")
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='service_templates'")
            for r in cur.fetchall(): print(f"- {r[0]} ({r[1]})")
        else:
             print("\nTable 'service_templates' DOES NOT EXIST.")

        if 'job_templates' in tables:
            print("\nColumns in job_templates:")
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='job_templates'")
            for r in cur.fetchall(): print(f"- {r[0]} ({r[1]})")
            
        cur.close(); conn.close()
    except Exception as e: print("Connection Error:", e)

if __name__ == '__main__': check_structure()
