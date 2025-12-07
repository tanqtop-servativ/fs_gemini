
import os
import psycopg2

def check_columns():
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
        exit(1)

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        sql = """
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'service_opportunities';
        """
        
        cur.execute(sql)
        rows = cur.fetchall()
        
        print("Columns in service_opportunities:")
        found_due_date = False
        for row in rows:
            print(f"- {row[0]} ({row[1]})")
            if row[0] == 'due_date':
                found_due_date = True
        
        if not found_due_date:
            print("\nWARNING: 'due_date' column is MISSING.")
        else:
            print("\n'due_date' column EXISTS.")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

if __name__ == "__main__":
    check_columns()
