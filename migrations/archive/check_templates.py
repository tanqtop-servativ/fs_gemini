
import os
import psycopg2

def check_structure():
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v
    except: pass
    
    conn_str = os.environ.get('DB_CONNECTION_STRING') or env_vars.get('DB_CONNECTION_STRING')
    if not conn_str: return print("No connection string")
    
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

        if 'job_templates' in tables:
            print("\nColumns in job_templates:")
            cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='job_templates'")
            for r in cur.fetchall(): print(f"- {r[0]} ({r[1]})")
            
        cur.close(); conn.close()
    except Exception as e: print(e)

if __name__ == '__main__': check_structure()
