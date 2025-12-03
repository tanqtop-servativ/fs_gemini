import os
import requests
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_admin_user():
    email = "admin@example.com"
    password = "admin123"
    
    print(f"Creating Supabase Auth user: {email}...")
    
    # 1. Create User via Supabase Admin API
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
    
    user_id = None
    
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        if response.status_code == 200:
            data = response.json()
            user_id = data['id']
            print(f"✅ User created/found. ID: {user_id}")
        elif response.status_code == 422: # Already exists?
             print("User might already exist. Trying to fetch ID...")
             # We can't easily list users via this simple script without pagination, 
             # but we can try to sign in or just assume we need to find it in DB.
             # Let's query the DB for the ID from auth.users
             conn = psycopg2.connect(DB_CONNECTION_STRING)
             cur = conn.cursor()
             cur.execute("SELECT id FROM auth.users WHERE email = %s", (email,))
             res = cur.fetchone()
             if res:
                 user_id = str(res[0])
                 print(f"✅ Found existing user ID: {user_id}")
             else:
                 print(f"❌ Could not create or find user. API Response: {response.text}")
                 return
             conn.close()
        else:
            print(f"❌ Error creating user: {response.text}")
            return

        if not user_id:
            return

        # 2. Update Profiles
        print("Updating profiles table...")
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # Check if profile exists
        cur.execute("SELECT id FROM profiles WHERE id = %s", (user_id,))
        if cur.fetchone():
            print("Updating existing profile...")
            cur.execute("""
                UPDATE profiles 
                SET is_superuser = true, first_name = 'Super', last_name = 'Admin'
                WHERE id = %s
            """, (user_id,))
        else:
            print("Creating new profile...")
            # We need a tenant_id. Let's pick the first one or create one.
            cur.execute("SELECT id FROM tenants LIMIT 1")
            tenant_res = cur.fetchone()
            if tenant_res:
                tenant_id = tenant_res[0]
            else:
                print("Creating default tenant...")
                cur.execute("INSERT INTO tenants (name) VALUES ('System Tenant') RETURNING id")
                tenant_id = cur.fetchone()[0]
            
            cur.execute("""
                INSERT INTO profiles (id, tenant_id, is_superuser, first_name, last_name)
                VALUES (%s, %s, true, 'Super', 'Admin')
            """, (user_id, tenant_id))
            
        conn.commit()
        print("✅ Admin profile configured successfully.")
        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_admin_user()
