import os
import psycopg2

def check_schema():
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

        tables = ['jobs', 'job_tasks', 'job_comments', 'job_timers', 'job_steps']
        for t in tables:
            print(f"\n--- {t} ---")
            cur.execute(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{t}'
            """)
            rows = cur.fetchall()
            if not rows:
                print("  (Table not found)")
            else:
                for r in rows:
                    print(f"  {r[0]}: {r[1]}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
