
import os
import psycopg2

def check_schema():
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
        
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'job_template_tasks'
        """)
        print("job_template_tasks columns:", cur.fetchall())

        conn.close()
    except Exception as e: print(e)

if __name__ == '__main__': check_schema()
