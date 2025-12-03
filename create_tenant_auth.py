import os
import requests
import json
from dotenv import load_dotenv
import psycopg2

load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL") # Need to add this to .env
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # Need to add this to .env
DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_supabase_user(email, password):
    """Creates a user in Supabase Auth using the Admin API."""
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
    
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    if response.status_code != 200:
        raise Exception(f"Failed to create auth user: {response.text}")
    
    return response.json()

def create_tenant_records(tenant_name, user_id, email, first, last):
    """Creates DB records for Tenant, Profile, and Person."""
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    try:
        # 1. Create Tenant
        print(f"Creating tenant '{tenant_name}'...")
        cur.execute("INSERT INTO tenants (name) VALUES (%s) RETURNING id", (tenant_name,))
        tenant_id = cur.fetchone()[0]
        
        # 1.5 Seed Roles from Template
        print("Seeding roles...")
        try:
            with open('tenant_templates.json', 'r') as f:
                templates = json.load(f)
                
            role_map = {} # name -> id
            for role in templates.get('roles', []):
                cur.execute("""
                    INSERT INTO roles (tenant_id, name, description)
                    VALUES (%s, %s, %s)
                    RETURNING id
                """, (tenant_id, role['name'], role['description']))
                role_id = cur.fetchone()[0]
                role_map[role['name']] = role_id
                print(f"  - Created role: {role['name']}")
                
        except Exception as e:
            print(f"⚠️ Warning: Failed to seed roles: {e}")
            # Fallback: Ensure 'Manager' exists at minimum
            cur.execute("INSERT INTO roles (tenant_id, name) VALUES (%s, 'Manager') RETURNING id", (tenant_id,))
            role_map = {'Manager': cur.fetchone()[0]}

        # 2. Create Profile (Links Auth User to Tenant)
        print("Creating profile...")
        cur.execute("""
            INSERT INTO public.profiles (id, tenant_id, is_superuser, first_name, last_name)
            VALUES (%s, %s, false, %s, %s)
        """, (user_id, tenant_id, first, last))
        
        # 3. Create Person (Business Entity)
        print("Creating person record...")
        cur.execute("""
            INSERT INTO people (tenant_id, user_id, first_name, last_name, email)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (tenant_id, user_id, first, last, email))
        person_id = cur.fetchone()[0]
        
        # 4. Assign Manager Role
        print("Assigning Manager role...")
        manager_role_id = role_map.get('Manager')
        if manager_role_id:
            cur.execute("INSERT INTO person_roles (person_id, role_id) VALUES (%s, %s)", (person_id, manager_role_id))
        else:
            print("⚠️ Error: Manager role not found for assignment.")
        
        conn.commit()
        print(f"✅ Tenant '{tenant_name}' created successfully with Admin {email} (ID: {tenant_id})")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Database error: {e}")
        raise e
    finally:
        cur.close()
        conn.close()

def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env")
        return

    print("--- Create New Tenant (Supabase Auth) ---")
    name = input("Tenant Name: ")
    email = input("Admin Email: ")
    password = input("Admin Password: ")
    first = input("Admin First Name: ")
    last = input("Admin Last Name: ")
    
    try:
        # 1. Create Auth User
        print("Creating Auth User...")
        user_data = create_supabase_user(email, password)
        user_id = user_data['id']
        print(f"Auth User created: {user_id}")
        
        # 2. Create DB Records
        create_tenant_records(name, user_id, email, first, last)
        
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    main()
