import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DB_CONNECTION_STRING')
if not db_url:
    print("Error: DB_CONNECTION_STRING not found")
    sys.exit(1)

sql = """
SELECT 
    n.nspname as schema,
    p.proname as name, 
    pg_get_function_arguments(p.oid) as args,
    pg_get_function_result(p.oid) as result_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname IN ('get_retry_analysis', 'get_correction_analysis', 'analyze_failure_patterns')
ORDER BY 1, 2;
"""

try:
    result = subprocess.run(['psql', db_url, '-c', sql], capture_output=True, text=True, check=True)
    print(result.stdout)
except subprocess.CalledProcessError as e:
    print(e.stderr)
