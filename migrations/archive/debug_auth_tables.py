
import os
import psycopg2

def check_tables():
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
        
        # Check profiles
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_name = 'profiles'")
        has_profiles = cur.fetchone()[0] > 0
        print(f"Has profiles: {has_profiles}")
        
        # Check app_users
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_name = 'app_users'")
        has_app_users = cur.fetchone()[0] > 0
        print(f"Has app_users: {has_app_users}")
        
        if has_profiles:
             cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles'")
             print("Profiles Columns:", [r[0] for r in cur.fetchall()])

        conn.close()
    except Exception as e: print(e)

if __name__ == '__main__': check_tables()
