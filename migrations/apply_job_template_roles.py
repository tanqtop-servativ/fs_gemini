#!/usr/bin/env python3
"""Apply job_template_roles migration"""
import os
import psycopg2

def main():
    conn_string = os.environ.get('DB_CONNECTION_STRING')
    if not conn_string:
        print("ERROR: DB_CONNECTION_STRING not set")
        return
    
    sql_path = os.path.join(os.path.dirname(__file__), 'create_job_template_roles.sql')
    with open(sql_path, 'r') as f:
        sql = f.read()
    
    conn = psycopg2.connect(conn_string)
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print("✅ job_template_roles table created successfully")
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    main()
