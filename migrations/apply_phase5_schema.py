import os
import psycopg2

def apply_migration():
    # Load .env manually
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
        return

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()

        files = ['create_job_timers.sql', 'create_job_comments.sql']
        
        for file in files:
            path = os.path.join("migrations", file)
            print(f"Applying {file}...")
            with open(path, "r") as f:
                sql = f.read()
            cur.execute(sql)
            conn.commit()
            print(f"Applied {file}.")
        
        # Notify reload
        cur.execute("NOTIFY pgrst, 'reload schema';")
        conn.commit()
        print("Schema reload notified.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error applying migration: {e}")

if __name__ == "__main__":
    apply_migration()
