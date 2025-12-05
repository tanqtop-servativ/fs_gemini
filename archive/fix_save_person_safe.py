import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def fix_function():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Updating save_person_safe function for UUIDs...")
        
        cur.execute("DROP FUNCTION IF EXISTS save_person_safe;")
        
        cur.execute("""
            CREATE OR REPLACE FUNCTION save_person_safe(
                p_id UUID,
                p_tenant_id UUID,
                p_first TEXT,
                p_last TEXT,
                p_email TEXT,
                p_role_ids UUID[]
            )
            RETURNS UUID
            LANGUAGE plpgsql
            AS $$
            DECLARE
                v_person_id UUID;
                r_id UUID;
            BEGIN
                -- A. Upsert Person
                IF p_id IS NULL THEN
                    INSERT INTO people (tenant_id, first_name, last_name, email)
                    VALUES (p_tenant_id, p_first, p_last, p_email)
                    RETURNING id INTO v_person_id;
                ELSE
                    UPDATE people 
                    SET first_name = p_first, last_name = p_last, email = p_email
                    WHERE id = p_id;
                    v_person_id := p_id;
                    
                    -- Wipe old roles to prepare for new set
                    DELETE FROM person_roles WHERE person_id = v_person_id;
                END IF;

                -- B. Insert Roles (Only if array provided)
                IF p_role_ids IS NOT NULL AND array_length(p_role_ids, 1) > 0 THEN
                    FOREACH r_id IN ARRAY p_role_ids
                    LOOP
                        INSERT INTO person_roles (person_id, role_id) VALUES (v_person_id, r_id);
                    END LOOP;
                END IF;

                RETURN v_person_id;
            END;
            $$;
        """)
        
        conn.commit()
        print("✅ Function updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_function()
