import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DB_CONNECTION_STRING')
if not db_url:
    print("Error: DB_CONNECTION_STRING not found")
    sys.exit(1)

# Query the function source
sql = """
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'get_correction_analysis';
"""

try:
    result = subprocess.run(['psql', db_url, '-c', sql], capture_output=True, text=True, check=True)
    print(result.stdout)
except subprocess.CalledProcessError as e:
    print(e.stderr)
