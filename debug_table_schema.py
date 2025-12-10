import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DB_CONNECTION_STRING')
if not db_url:
    print("Error: DB_CONNECTION_STRING not found")
    sys.exit(1)

# Query pg_attribute to get column names
sql = """
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs'
ORDER BY ordinal_position;
"""

try:
    result = subprocess.run(['psql', db_url, '-c', sql], capture_output=True, text=True, check=True)
    print(result.stdout)
except subprocess.CalledProcessError as e:
    print(e.stderr)
