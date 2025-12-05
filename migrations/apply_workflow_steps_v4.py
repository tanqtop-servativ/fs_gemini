
import os
import psycopg2

def apply_migration():
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
        
        with open('migrations/create_service_workflow_steps_v4.sql', 'r') as f:
            sql = f.read()
            
        cur.execute(sql)
        conn.commit()
        print("Successfully updated policies for service_workflow_steps table.")
        
        # Reload schema cache
        cur.execute("NOTIFY pgrst, 'reload schema';")
        conn.commit()
        print("Schema cache reloaded.")

        cur.close(); conn.close()
    except Exception as e: print(e)

if __name__ == '__main__': apply_migration()
