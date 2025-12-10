import os
import sys
import subprocess
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DB_CONNECTION_STRING')
if not db_url:
    print("Error: DB_CONNECTION_STRING not found")
    sys.exit(1)

tables = [
    "bookings",
    "calendar_feeds",
    "job_inputs",
    "job_template_inputs",
    "job_templates",
    "profiles",
    "roles",
    "service_jobs",
    "standard_line_items"
]

for table in tables:
    sql = f"SELECT count(*) FROM {table} WHERE tenant_id IS NULL;"
    try:
        # We need to run this as a superuser or bypass RLS, otherwise we might see 0 if we are restricted (though connection string is usually admin).
        result = subprocess.run(['psql', db_url, '-c', sql], capture_output=True, text=True)
        count = result.stdout.strip().split('\n')[-2].strip() if result.returncode == 0 else "Error"
        print(f"{table}: {count} rows with NULL tenant_id")
    except Exception as e:
        print(f"{table}: Exception {e}")
