import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DB_CONNECTION_STRING')
if not db_url:
    print("Error: DB_CONNECTION_STRING not found")
    sys.exit(1)

try:
    with open('backfill_tenants.sql', 'r') as f:
        sql = f.read()
    
    result = subprocess.run(['psql', db_url, '-f', 'backfill_tenants.sql'], capture_output=True, text=True, check=True)
    print(result.stdout)
except Exception as e:
    print(e)
    if hasattr(e, 'stderr'):
        print(e.stderr)
