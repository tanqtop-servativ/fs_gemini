
import os
import psycopg2

def check_constraints():
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
        
        # Check references TO job_template_tasks
        sql = """
        SELECT
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'job_template_tasks';
        """
        cur.execute(sql)
        rows = cur.fetchall()
        if not rows:
            print("No FKs pointing TO job_template_tasks.")
        else:
            print("References to job_template_tasks:", rows)

        conn.close()
    except Exception as e: print(e)

if __name__ == '__main__': check_constraints()
