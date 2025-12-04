import os
import psycopg2
import requests
import json
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def get_user_id(email):
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json"
    }
    
    # Simple list (assuming it's in the first page since I just created it)
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print(f"❌ Error fetching users: {response.text}")
        return None

    users = response.json().get('users', [])
    for u in users:
        if u['email'] == email:
            return u['id']
    return None

def fix_user():
    email = "beta@test.com"
    tenant_id = 10
    
    print(f"🛠️ Fixing user {email} for Tenant {tenant_id}...")
    
    user_id = get_user_id(email)
    if not user_id:
        print("❌ User not found in Auth. Did you create it?")
        return

    print(f"✅ Found Auth User ID: {user_id}")
    
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # 1. Check if profile exists
        cur.execute("SELECT id FROM profiles WHERE id = %s", (user_id,))
        if cur.fetchone():
            print("⚠️ Profile already exists.")
        else:
            print("   Creating Profile...")
            # Need first/last name. Let's assume "Beta" "Corp" based on previous finding, or just "Admin"
            cur.execute("""
                INSERT INTO profiles (id, tenant_id, first_name, last_name, is_superuser)
                VALUES (%s, %s, 'Beta', 'Tester', false)
            """, (user_id, tenant_id))
            
        # 2. Update People
        print("   Updating People record...")
        cur.execute("""
            UPDATE people 
            SET user_id = %s 
            WHERE tenant_id = %s AND email = %s
        """, (user_id, tenant_id, email))
        
        if cur.rowcount == 0:
            print("⚠️ No person found with that email/tenant. Creating one...")
            cur.execute("""
                INSERT INTO people (tenant_id, first_name, last_name, email, user_id)
                VALUES (%s, 'Beta', 'Tester', %s, %s)
                RETURNING id
            """, (tenant_id, email, user_id))
            person_id = cur.fetchone()[0]
            
            # Assign Role
            print("   Assigning Manager Role...")
            cur.execute("SELECT id FROM roles WHERE tenant_id = %s AND name = 'Manager'", (tenant_id,))
            role_id = cur.fetchone()[0]
            cur.execute("INSERT INTO person_roles (person_id, role_id) VALUES (%s, %s)", (person_id, role_id))
            
        conn.commit()
        print("✅ Fix Complete.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_user()
