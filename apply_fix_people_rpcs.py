#!/usr/bin/env python3
"""Apply the fix for list_people and get_person_detail RPCs"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    sys.exit(1)

print(f"Connecting to: {url}")
supabase = create_client(url, key)

# Read and execute the migration
with open('migrations/fix_people_rpcs_user_id.sql', 'r') as f:
    sql = f.read()

try:
    response = supabase.rpc('exec_sql', {'sql_query': sql}).execute()
    print("✅ Migration applied successfully!")
    print(response)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
