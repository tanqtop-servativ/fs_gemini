
import os
import psycopg2

def apply_migration():
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
    except:
        pass

    conn_str = os.environ.get('DB_CONNECTION_STRING') or env_vars.get('DB_CONNECTION_STRING')

    if not conn_str:
        print("Error: DB_CONNECTION_STRING not found.")
        exit(1)

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        # Read the SQL file content
        with open('migrations/add_missing_opp_columns.sql', 'r') as f:
            sql = f.read()
        
        cur.execute(sql)
        conn.commit()
        print("Successfully executed migration: Added missing columns.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

if __name__ == "__main__":
    apply_migration()
