import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

SQL = """
CREATE OR REPLACE FUNCTION public.manage_tenant_user(p_operation text, p_tenant_id integer, p_user_id uuid DEFAULT NULL::uuid, p_email text DEFAULT NULL::text, p_password text DEFAULT NULL::text, p_first text DEFAULT NULL::text, p_last text DEFAULT NULL::text)
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
        -- Soft Delete
        UPDATE app_users 
        SET deleted_at = NOW()
        WHERE id = p_user_id AND tenant_id = p_tenant_id;
        
        RETURN jsonb_build_object('success', true);

    ELSIF p_operation = 'RESTORE' THEN
        -- Restore
        UPDATE app_users 
        SET deleted_at = NULL
        WHERE id = p_user_id AND tenant_id = p_tenant_id;
        
        RETURN jsonb_build_object('success', true);
        
    ELSE
        RAISE EXCEPTION 'Invalid operation: %', p_operation;
    END IF;
END;
$function$;
"""

def run_update():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        print("Updating manage_tenant_user function...")
        cur.execute(SQL)
        conn.commit()
        print("✅ Function updated successfully.")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    run_update()
