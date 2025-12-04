import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def create_user(email, password):
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True
    }
    
    print(f"🚀 Creating user: {email} at {SUPABASE_URL}...")
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code >= 400:
            print("❌ Creation Failed")
        else:
            print("✅ Creation Success")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    create_user("beta@test.com", "password123")
