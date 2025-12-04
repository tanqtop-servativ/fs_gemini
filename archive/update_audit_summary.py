import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def update_audit_summary():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()

        print("Adding record_summary column to audit_logs...")
        cur.execute("""
            ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_summary TEXT;
        """)

        print("Updating record_audit_log function...")
        cur.execute("""
        CREATE OR REPLACE FUNCTION record_audit_log()
        RETURNS TRIGGER AS $$
        DECLARE
            v_user_id UUID;
            v_old_data JSONB;
            v_new_data JSONB;
            v_summary TEXT;
        BEGIN
            -- Try to get user ID from Supabase Auth, then from custom session variable
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

            -- Determine Record Summary based on Table Name
            -- Use NEW for INSERT/UPDATE, OLD for DELETE
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

            INSERT INTO audit_logs (table_name, record_id, operation, changed_by, old_values, new_values, record_summary)
            VALUES (
                TG_TABLE_NAME,
                COALESCE(NEW.id, OLD.id),
                TG_OP,
                v_user_id,
                v_old_data,
                v_new_data,
                v_summary
            );
            
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)

        print("Updating audit_history_view...")
        cur.execute("""
        DROP VIEW IF EXISTS audit_history_view CASCADE;
        CREATE VIEW audit_history_view AS
        SELECT 
            al.id,
            al.table_name,
            al.record_id,
            al.operation,
            al.changed_at,
            al.changed_by,
            au.email as changed_by_email,
            au.first_name as changed_by_first_name,
            au.last_name as changed_by_last_name,
            al.old_values,
            al.new_values,
            al.record_summary,
            CASE
                WHEN al.operation = 'INSERT' THEN 'Created record'
                WHEN al.operation = 'DELETE' THEN 'Deleted record'
                WHEN al.operation = 'UPDATE' THEN 'Updated fields: ' || (
                    SELECT string_agg(key, ', ')
                    FROM jsonb_each(al.new_values)
                    WHERE al.new_values -> key IS DISTINCT FROM al.old_values -> key
                )
                ELSE al.operation
            END as description
        FROM audit_logs al
        LEFT JOIN app_users au ON al.changed_by = au.id;
        """)

        print("Recreating get_property_audit_history RPC...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION get_property_audit_history(p_property_id INT)
            RETURNS SETOF audit_history_view AS $$
            BEGIN
                RETURN QUERY
                SELECT *
                FROM audit_history_view
                WHERE 
                    -- Direct Property Changes
                    (table_name = 'properties' AND record_id = p_property_id)
                    OR 
                    -- Related Table Changes (where property_id matches)
                    (
                        table_name IN (
                            'property_access_codes', 
                            'calendar_feeds', 
                            'property_inventory', 
                            'property_attachments', 
                            'property_reference_photos'
                        ) 
                        AND (
                            (new_values->>'property_id')::INT = p_property_id 
                            OR 
                            (old_values->>'property_id')::INT = p_property_id
                        )
                    )
                ORDER BY changed_at DESC;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)

        conn.commit()
        print("✅ Audit system updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_audit_summary()
