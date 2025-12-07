
import os
import psycopg2

def check_service_jobs():
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v.strip().strip("'").strip('"')
    except: pass
    
    conn_str = os.environ.get('DB_CONNECTION_STRING') or env_vars.get('DB_CONNECTION_STRING')
    if not conn_str: return
    conn_str = conn_str.strip("'").strip('"')

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        print("\nColumns in service_jobs:")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='service_jobs'")
        for r in cur.fetchall(): print(f"- {r[0]} ({r[1]})")
            
        cur.close(); conn.close()
    except Exception as e: print(e)

if __name__ == '__main__': check_service_jobs()
