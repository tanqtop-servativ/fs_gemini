import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DB_CONNECTION_STRING')
if not db_url:
    print("Error: DB_CONNECTION_STRING not found")
    sys.exit(1)

# Test calling the function directly
sql = """
SELECT get_correction_analysis('25572e31-617c-4f59-b637-502ab6d09d2a'::uuid, 90);
"""

try:
    result = subprocess.run(['psql', db_url, '-c', sql], capture_output=True, text=True)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    print("Return code:", result.returncode)
except Exception as e:
    print(f"Exception: {e}")
