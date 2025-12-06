#!/usr/bin/env python3
"""Apply the fixed create_full_person RPC migration."""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_connection_string = os.environ.get('DB_CONNECTION_STRING')

try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sql_file = os.path.join(script_dir, 'create_full_person_rpc.sql')

    with open(sql_file, 'r') as f:
        sql = f.read()

    conn = psycopg2.connect(db_connection_string)
    cur = conn.cursor()

    print("Applying create_full_person RPC fix...")
    cur.execute(sql)
    conn.commit()
    print("✅ Successfully updated create_full_person RPC")

    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    exit(1)

