
import os
import psycopg2

def apply_migration():
    # Load .env manually to avoid dependency on python-dotenv if not installed commonly
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
        
        sql = "ALTER TABLE service_opportunities ALTER COLUMN service_template_id DROP NOT NULL;"
        
        cur.execute(sql)
        conn.commit()
        print("Successfully executed: " + sql)
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

if __name__ == "__main__":
    apply_migration()
