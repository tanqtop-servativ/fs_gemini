import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_rpc():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🛠️ Creating 'create_tenant_for_user' RPC...")
        
        rpc_sql = """
        CREATE OR REPLACE FUNCTION public.create_tenant_for_user(
            p_tenant_name text, 
            p_user_id uuid, 
            p_first_name text, 
            p_last_name text, 
            p_email text
        )
        RETURNS jsonb
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $function$
        DECLARE
            v_tenant_id integer;
            v_person_id integer;
            v_role_id integer;
        BEGIN
            -- 1. Create Tenant
            INSERT INTO tenants (name) VALUES (p_tenant_name) RETURNING id INTO v_tenant_id;

            -- 2. Create Profile (Links Auth User to Tenant)
            INSERT INTO profiles (id, tenant_id, first_name, last_name, is_superuser)
            VALUES (p_user_id, v_tenant_id, p_first_name, p_last_name, false);

            -- 3. Create Person Record (For business logic)
            INSERT INTO people (tenant_id, first_name, last_name, email, user_id)
            VALUES (v_tenant_id, p_first_name, p_last_name, p_email, p_user_id)
            RETURNING id INTO v_person_id;

            -- 4. Assign Manager Role
            -- Check if 'Manager' role exists for this tenant, if not create it.
            SELECT id INTO v_role_id FROM roles WHERE tenant_id = v_tenant_id AND name = 'Manager';
            
            IF v_role_id IS NULL THEN
                INSERT INTO roles (tenant_id, name, description) 
                VALUES (v_tenant_id, 'Manager', 'Tenant Administrator') 
                RETURNING id INTO v_role_id;
            END IF;

            -- Assign Role
            INSERT INTO person_roles (person_id, role_id) VALUES (v_person_id, v_role_id);

            RETURN jsonb_build_object(
                'tenant_id', v_tenant_id,
                'user_id', p_user_id,
                'person_id', v_person_id
            );
        END;
        $function$;
        """
        
        cur.execute(rpc_sql)
        conn.commit()
        print("✅ RPC created successfully.")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_rpc()
