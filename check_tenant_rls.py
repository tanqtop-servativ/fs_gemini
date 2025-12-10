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
    c.relname AS table_name,
    CASE WHEN a.attname IS NOT NULL THEN TRUE ELSE FALSE END AS has_tenant_id,
    c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id'
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;
"""

try:
    result = subprocess.run(['psql', db_url, '-c', sql], capture_output=True, text=True)
    # Parse output to filter for has_tenant_id = t AND rls_enabled = f
    lines = result.stdout.splitlines()
    print(result.stdout)
except Exception as e:
    print(e)
