import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

# 1. Create app_users table
sql_create_table = """
CREATE TABLE IF NOT EXISTS public.app_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL, -- Simple hash for demo
    tenant_id integer REFERENCES tenants(id),
    is_superuser boolean DEFAULT false,
    first_name text,
    last_name text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS (even if we don't use it strictly yet, good practice)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read (for login check) - In prod, be stricter
CREATE POLICY "Allow public read" ON public.app_users FOR SELECT USING (true);
"""

# 2. RPC: create_tenant_with_admin
sql_create_tenant_rpc = """
CREATE OR REPLACE FUNCTION public.create_tenant_with_admin(
    p_tenant_name text,
    p_admin_email text,
    p_admin_password text,
    p_admin_first_name text,
    p_admin_last_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_tenant_id integer;
    v_user_id uuid;
    v_person_id integer;
    v_role_id integer;
BEGIN
    -- 1. Create Tenant
    INSERT INTO tenants (name) VALUES (p_tenant_name) RETURNING id INTO v_tenant_id;

    -- 2. Create User
    INSERT INTO app_users (email, password_hash, tenant_id, first_name, last_name, is_superuser)
    VALUES (p_admin_email, p_admin_password, v_tenant_id, p_admin_first_name, p_admin_last_name, false)
    RETURNING id INTO v_user_id;

    -- 3. Create Person Profile
    INSERT INTO people (tenant_id, first_name, last_name, email)
    VALUES (v_tenant_id, p_admin_first_name, p_admin_last_name, p_admin_email)
    RETURNING id INTO v_person_id;

    -- 4. Assign Manager Role
    -- Find 'Manager' role for this tenant (or generic)
    -- Assuming roles are per-tenant, we might need to create default roles first.
    -- For now, let's check if a 'Manager' role exists for this tenant, if not create it.
    
    SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tenant_id AND name = 'Manager';
    
    IF v_role_id IS NULL THEN
        INSERT INTO roles (tenant_id, name, description) 
        VALUES (v_tenant_id, 'Manager', 'Tenant Administrator') 
        RETURNING id INTO v_role_id;
    END IF;

    INSERT INTO person_roles (person_id, role_id) VALUES (v_person_id, v_role_id);

    RETURN jsonb_build_object(
        'tenant_id', v_tenant_id,
        'user_id', v_user_id,
        'person_id', v_person_id
    );
END;
$function$;
"""

# 3. Update RPC: verify_app_access
# Now accepts email/password and returns user object
sql_update_auth_rpc = """
DROP FUNCTION IF EXISTS public.verify_app_access(text);

CREATE OR REPLACE FUNCTION public.verify_app_access(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_user record;
BEGIN
    SELECT * INTO v_user FROM app_users WHERE email = p_email;

    IF v_user IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Simple password check (In prod, use pgcrypto/bcrypt)
    IF v_user.password_hash = p_password THEN
        RETURN jsonb_build_object(
            'success', true,
            'user', jsonb_build_object(
                'id', v_user.id,
                'email', v_user.email,
                'tenant_id', v_user.tenant_id,
                'is_superuser', v_user.is_superuser,
                'first_name', v_user.first_name,
                'last_name', v_user.last_name
            )
        );
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid password');
    END IF;
END;
$function$;
"""

# 4. Seed Superuser
sql_seed_superuser = """
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app_users WHERE email = 'admin@example.com') THEN
        INSERT INTO app_users (email, password_hash, is_superuser, first_name, last_name)
        VALUES ('admin@example.com', 'admin123', true, 'Super', 'Admin');
    END IF;
END $$;
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Creating app_users table...")
    cur.execute(sql_create_table)
    
    print("Creating create_tenant_with_admin RPC...")
    cur.execute(sql_create_tenant_rpc)
    
    print("Updating verify_app_access RPC...")
    cur.execute(sql_update_auth_rpc)
    
    print("Seeding superuser...")
    cur.execute(sql_seed_superuser)
    
    conn.commit()
    print("✅ Database setup complete.")
            
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
