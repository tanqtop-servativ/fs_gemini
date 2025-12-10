#!/usr/bin/env python3
"""Apply the list_jobs and list_properties RPCs migration"""

import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

key = os.getenv('SUPABASE_SERVICE_KEY')
db_url = os.getenv('DB_CONNECTION_STRING')

if not db_url:
    print("Error: DB_CONNECTION_STRING not found in .env")
    sys.exit(1)

print(f"Connecting to DB...")

# Read the SQL file
sql_file = 'migrations/create_list_rpcs.sql'
with open(sql_file, 'r') as f:
    sql = f.read()

# Execute via psql
try:
    result = subprocess.run(['psql', db_url, '-c', sql], capture_output=True, text=True, check=True)
    print("✅ Migration applied successfully!")
    print(result.stdout)
except subprocess.CalledProcessError as e:
    print("❌ Error applying migration:")
    print(e.stderr)
    sys.exit(1)
