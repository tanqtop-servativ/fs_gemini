import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

# 1. get_tenant_users
sql_get_users = """
CREATE OR REPLACE FUNCTION public.get_tenant_users(p_tenant_id integer)
RETURNS TABLE (
    id uuid,
    email text,
    first_name text,
    last_name text,
    is_superuser boolean,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.first_name, u.last_name, u.is_superuser, u.created_at
    FROM app_users u
    WHERE u.tenant_id = p_tenant_id
    ORDER BY u.created_at DESC;
END;
$function$;
"""

# 2. update_tenant
sql_update_tenant = """
CREATE OR REPLACE FUNCTION public.update_tenant(p_tenant_id integer, p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    UPDATE tenants SET name = p_name WHERE id = p_tenant_id;
END;
$function$;
"""

# 3. delete_tenant (Hard Delete with Cascade)
sql_delete_tenant = """
CREATE OR REPLACE FUNCTION public.delete_tenant(p_tenant_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Manual cleanup if FKs don't cascade (assuming they might not for some tables)
    -- Ideally, we should rely on ON DELETE CASCADE, but let's be safe.
    
    -- Delete Users
    DELETE FROM app_users WHERE tenant_id = p_tenant_id;
    
    -- Delete People (and their roles via cascade usually)
    DELETE FROM people WHERE tenant_id = p_tenant_id;
    
    -- Delete Properties
    DELETE FROM properties WHERE tenant_id = p_tenant_id;
    
    -- Delete Tenant
    DELETE FROM tenants WHERE id = p_tenant_id;
END;
$function$;
"""

# 4. manage_tenant_user
sql_manage_user = """
CREATE OR REPLACE FUNCTION public.manage_tenant_user(
    p_operation text, -- 'CREATE', 'UPDATE', 'DELETE'
    p_tenant_id integer,
    p_user_id uuid DEFAULT NULL,
    p_email text DEFAULT NULL,
    p_password text DEFAULT NULL,
    p_first text DEFAULT NULL,
    p_last text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_new_id uuid;
BEGIN
    IF p_operation = 'CREATE' THEN
        INSERT INTO app_users (email, password_hash, tenant_id, first_name, last_name, is_superuser)
        VALUES (p_email, p_password, p_tenant_id, p_first, p_last, false)
        RETURNING id INTO v_new_id;
        
        -- Also create person profile for consistency
        INSERT INTO people (tenant_id, first_name, last_name, email)
        VALUES (p_tenant_id, p_first, p_last, p_email);
        
        RETURN jsonb_build_object('success', true, 'id', v_new_id);
        
    ELSIF p_operation = 'UPDATE' THEN
        UPDATE app_users 
        SET 
            email = COALESCE(p_email, email),
            first_name = COALESCE(p_first, first_name),
            last_name = COALESCE(p_last, last_name),
            password_hash = CASE WHEN p_password IS NOT NULL AND p_password <> '' THEN p_password ELSE password_hash END
        WHERE id = p_user_id AND tenant_id = p_tenant_id;
        
        RETURN jsonb_build_object('success', true);
        
    ELSIF p_operation = 'DELETE' THEN
        DELETE FROM app_users WHERE id = p_user_id AND tenant_id = p_tenant_id;
        RETURN jsonb_build_object('success', true);
        
    ELSE
        RAISE EXCEPTION 'Invalid operation: %', p_operation;
    END IF;
END;
$function$;
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Creating get_tenant_users RPC...")
    cur.execute(sql_get_users)
    
    print("Creating update_tenant RPC...")
    cur.execute(sql_update_tenant)
    
    print("Creating delete_tenant RPC...")
    cur.execute(sql_delete_tenant)
    
    print("Creating manage_tenant_user RPC...")
    cur.execute(sql_manage_user)
    
    conn.commit()
    print("✅ CRUD RPCs created successfully.")
            
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
