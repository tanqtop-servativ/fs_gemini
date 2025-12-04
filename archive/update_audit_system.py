import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def update_audit_system():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        # 1. Update Trigger Function to use app.current_user_id
        print("Updating record_audit_log function...")
        cur.execute("""
        CREATE OR REPLACE FUNCTION record_audit_log()
        RETURNS TRIGGER AS $$
        DECLARE
            v_user_id UUID;
            v_old_data JSONB;
            v_new_data JSONB;
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

            INSERT INTO audit_logs (table_name, record_id, operation, changed_by, old_values, new_values)
            VALUES (
                TG_TABLE_NAME,
                COALESCE(NEW.id, OLD.id),
                TG_OP,
                v_user_id,
                v_old_data,
                v_new_data
            );
            
            RETURN COALESCE(NEW, OLD);
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)
        
        # 2. Update View to join app_users
        print("Updating audit_history_view...")
        cur.execute("""
        DROP VIEW IF EXISTS audit_history_view;
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
        
        conn.commit()
        print("✅ Audit system updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_audit_system()
