import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def run_migration():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()

        print("1. Adding tenant_id to bookings...")
        cur.execute("""
            ALTER TABLE bookings 
            ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
        """)

        print("2. Backfilling bookings tenant_id...")
        cur.execute("""
            UPDATE bookings b
            SET tenant_id = p.tenant_id
            FROM properties p
            WHERE b.property_id = p.id
            AND b.tenant_id IS NULL;
        """)
        
        print("3. Adding trigger for bookings tenant_id...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION set_booking_tenant_id()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.tenant_id IS NULL THEN
                    SELECT tenant_id INTO NEW.tenant_id
                    FROM properties
                    WHERE id = NEW.property_id;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_set_booking_tenant_id ON bookings;
            CREATE TRIGGER trg_set_booking_tenant_id
            BEFORE INSERT OR UPDATE ON bookings
            FOR EACH ROW
            EXECUTE FUNCTION set_booking_tenant_id();
        """)

        print("4. Adding tenant_id to audit_logs...")
        cur.execute("""
            ALTER TABLE audit_logs 
            ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
        """)

        print("5. Backfilling audit_logs tenant_id...")
        # Attempt to infer tenant_id from JSON data
        cur.execute("""
            UPDATE audit_logs
            SET tenant_id = COALESCE(
                (new_values->>'tenant_id')::integer, 
                (old_values->>'tenant_id')::integer,
                (SELECT tenant_id FROM app_users WHERE id = changed_by)
            )
            WHERE tenant_id IS NULL;
        """)

        print("6. Updating record_audit_log trigger function...")
        cur.execute("""
        CREATE OR REPLACE FUNCTION record_audit_log()
        RETURNS TRIGGER AS $$
        DECLARE
            v_user_id UUID;
            v_old_data JSONB;
            v_new_data JSONB;
            v_summary TEXT;
            v_tenant_id INT;
        BEGIN
            -- Try to get user ID
            v_user_id := auth.uid();
            IF v_user_id IS NULL THEN
                BEGIN
                    v_user_id := current_setting('app.current_user_id', true)::UUID;
                EXCEPTION WHEN OTHERS THEN
                    v_user_id := NULL;
                END;
            END IF;

            IF (TG_OP = 'DELETE') THEN
                v_old_data := to_jsonb(OLD);
                v_new_data := null;
            ELSIF (TG_OP = 'INSERT') THEN
                v_old_data := null;
                v_new_data := to_jsonb(NEW);
            ELSE
                v_old_data := to_jsonb(OLD);
                v_new_data := to_jsonb(NEW);
            END IF;

            -- Determine Record Summary
            IF TG_TABLE_NAME = 'people' THEN
                v_summary := COALESCE(NEW.first_name, OLD.first_name) || ' ' || COALESCE(NEW.last_name, OLD.last_name);
            ELSIF TG_TABLE_NAME = 'properties' THEN
                v_summary := COALESCE(NEW.name, OLD.name);
            ELSIF TG_TABLE_NAME = 'tenants' THEN
                v_summary := COALESCE(NEW.name, OLD.name);
            ELSIF TG_TABLE_NAME = 'app_users' THEN
                v_summary := COALESCE(NEW.email, OLD.email);
            ELSIF TG_TABLE_NAME IN ('bom_templates', 'job_templates', 'roles') THEN
                v_summary := COALESCE(NEW.name, OLD.name);
            ELSIF TG_TABLE_NAME = 'property_attachments' THEN
                v_summary := COALESCE(NEW.file_name, OLD.file_name);
            ELSIF TG_TABLE_NAME = 'property_reference_photos' THEN
                v_summary := COALESCE(NEW.label, OLD.label, 'Photo');
            ELSE
                v_summary := NULL;
            END IF;

            -- Determine Tenant ID
            -- 1. Check if table has tenant_id column
            -- Note: We can't dynamically check column existence easily in PL/pgSQL without dynamic SQL, 
            -- but we can try to access NEW.tenant_id or OLD.tenant_id if we assume it might exist.
            -- However, accessing a non-existent column causes an error.
            -- So we rely on JSONB extraction which is safe.
            
            v_tenant_id := COALESCE(
                (to_jsonb(NEW)->>'tenant_id')::integer,
                (to_jsonb(OLD)->>'tenant_id')::integer
            );
            
            -- If still null, maybe try to look it up? 
            -- For now, we leave it null if not directly on the record. 
            -- The view can fallback to user's tenant.

            INSERT INTO audit_logs (table_name, record_id, operation, changed_by, old_values, new_values, record_summary, tenant_id)
            VALUES (
                TG_TABLE_NAME,
                COALESCE(NEW.id, OLD.id),
                TG_OP,
                v_user_id,
                v_old_data,
                v_new_data,
                v_summary,
                v_tenant_id
            );
            
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)

        conn.commit()
        print("✅ Migration complete.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    run_migration()
