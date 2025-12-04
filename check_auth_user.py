import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def check_user(email):
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    print(f"🔍 Searching for user: {email}")
    
    page = 1
    per_page = 50
    found = False
    
    while True:
        print(f"   Fetching page {page}...")
        paged_url = f"{url}?page={page}&per_page={per_page}"
        response = requests.get(paged_url, headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Error fetching users: {response.text}")
            return

        users = response.json().get('users', [])
        if not users:
            break
            
        for u in users:
            if u['email'] == email:
                print("\n✅ User Found:")
                print(f"   ID: {u['id']}")
                print(f"   Email: {u['email']}")
                print(f"   Confirmed At: {u.get('email_confirmed_at')}")
                print(f"   Last Sign In: {u.get('last_sign_in_at')}")
                print(f"   Role: {u.get('role')}")
                print(f"   App Metadata: {json.dumps(u.get('app_metadata'), indent=2)}")
                found = True
                break
        
        if found:
            break
            
        page += 1
            
    if not found:
        print("❌ User not found in Auth (checked all pages).")

if __name__ == "__main__":
    check_user("beta@test.com")
