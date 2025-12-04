import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def update_rpcs():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # 1. create_tenant_with_admin
        print("Updating create_tenant_with_admin...")
        cur.execute("""
        CREATE OR REPLACE FUNCTION create_tenant_with_admin(
            p_tenant_name TEXT,
            p_admin_email TEXT,
            p_admin_password TEXT,
            p_admin_first_name TEXT,
            p_admin_last_name TEXT,
            p_acting_user_id UUID DEFAULT NULL
        )
        RETURNS JSONB AS $$
        DECLARE
            v_tenant_id INT;
            v_user_id UUID;
            v_person_id INT;
            v_role_id INT;
        BEGIN
            -- Set acting user for audit
            IF p_acting_user_id IS NOT NULL THEN
                PERFORM set_config('app.current_user_id', p_acting_user_id::text, true);
            END IF;

            -- 1. Create Tenant
            INSERT INTO tenants (name) VALUES (p_tenant_name) RETURNING id INTO v_tenant_id;
            
            -- 2. Create App User (Admin)
            INSERT INTO app_users (email, password_hash, tenant_id, is_superuser, first_name, last_name)
            VALUES (p_admin_email, p_admin_password, v_tenant_id, false, p_admin_first_name, p_admin_last_name)
            RETURNING id INTO v_user_id;

            -- 3. Create Person Profile
            INSERT INTO people (tenant_id, first_name, last_name, email, phone)
            VALUES (v_tenant_id, p_admin_first_name, p_admin_last_name, p_admin_email, '')
            RETURNING id INTO v_person_id;

            -- 4. Assign Manager Role
            SELECT id INTO v_role_id FROM roles WHERE name = 'Manager';
            
            INSERT INTO person_roles (person_id, role_id)
            VALUES (v_person_id, v_role_id);

            RETURN jsonb_build_object('tenant_id', v_tenant_id, 'user_id', v_user_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Failed to create tenant: %', SQLERRM;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)

        # 2. update_tenant
        print("Updating update_tenant...")
        cur.execute("""
        CREATE OR REPLACE FUNCTION update_tenant(
            p_tenant_id INT,
            p_name TEXT,
            p_acting_user_id UUID DEFAULT NULL
        )
        RETURNS VOID AS $$
        BEGIN
            -- Set acting user for audit
            IF p_acting_user_id IS NOT NULL THEN
                PERFORM set_config('app.current_user_id', p_acting_user_id::text, true);
            END IF;

            UPDATE tenants SET name = p_name WHERE id = p_tenant_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)

        # 3. delete_tenant (Soft Delete)
        print("Updating delete_tenant...")
        cur.execute("""
        CREATE OR REPLACE FUNCTION delete_tenant(
            p_tenant_id INT,
            p_acting_user_id UUID DEFAULT NULL
        )
        RETURNS VOID AS $$
        BEGIN
            -- Set acting user for audit
            IF p_acting_user_id IS NOT NULL THEN
                PERFORM set_config('app.current_user_id', p_acting_user_id::text, true);
            END IF;

            UPDATE tenants SET is_active = false WHERE id = p_tenant_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)

        # 4. manage_tenant_user
        print("Updating manage_tenant_user...")
        cur.execute("""
        CREATE OR REPLACE FUNCTION manage_tenant_user(
            p_operation TEXT,
            p_tenant_id INT,
            p_user_id UUID DEFAULT NULL,
            p_email TEXT DEFAULT NULL,
            p_password TEXT DEFAULT NULL,
            p_first TEXT DEFAULT NULL,
            p_last TEXT DEFAULT NULL,
            p_acting_user_id UUID DEFAULT NULL
        )
        RETURNS VOID AS $$
        DECLARE
            v_new_id UUID;
            v_person_id INT;
            v_role_id INT;
        BEGIN
            -- Set acting user for audit
            IF p_acting_user_id IS NOT NULL THEN
                PERFORM set_config('app.current_user_id', p_acting_user_id::text, true);
            END IF;

            IF p_operation = 'CREATE' THEN
                -- Create User
                INSERT INTO app_users (email, password_hash, tenant_id, is_superuser, first_name, last_name)
                VALUES (p_email, p_password, p_tenant_id, false, p_first, p_last)
                RETURNING id INTO v_new_id;

                -- Create Person
                INSERT INTO people (tenant_id, first_name, last_name, email)
                VALUES (p_tenant_id, p_first, p_last, p_email)
                RETURNING id INTO v_person_id;

                -- Assign Role
                SELECT id INTO v_role_id FROM roles WHERE name = 'Manager';
                INSERT INTO person_roles (person_id, role_id) VALUES (v_person_id, v_role_id);

            ELSIF p_operation = 'UPDATE' THEN
                UPDATE app_users 
                SET email = COALESCE(p_email, email),
                    first_name = COALESCE(p_first, first_name),
                    last_name = COALESCE(p_last, last_name),
                    password_hash = CASE WHEN p_password IS NOT NULL AND p_password <> '' THEN p_password ELSE password_hash END
                WHERE id = p_user_id;

                -- Also update person? (Optional, but good practice)
                UPDATE people
                SET first_name = COALESCE(p_first, first_name),
                    last_name = COALESCE(p_last, last_name),
                    email = COALESCE(p_email, email)
                WHERE email = (SELECT email FROM app_users WHERE id = p_user_id); -- Heuristic link

            ELSIF p_operation = 'DELETE' THEN
                DELETE FROM app_users WHERE id = p_user_id;
                -- We don't delete the person record automatically to preserve history, or we could.
            END IF;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)
        
        conn.commit()
        print("✅ RPCs updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_rpcs()
