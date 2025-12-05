
import os
import psycopg2

def check_triggers():
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
    
    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        tables = ['service_templates', 'service_workflow_steps']
        
        for t in tables:
            print(f"--- Triggers for {t} ---")
            cur.execute(f"SELECT trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table = '{t}'")
            rows = cur.fetchall()
            if not rows:
                print("No triggers found.")
            else:
                for r in rows:
                    print(r)

        conn.close()
    except Exception as e: print(e)

if __name__ == '__main__': check_triggers()
