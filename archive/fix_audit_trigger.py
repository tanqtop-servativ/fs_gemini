import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def fix_audit_function():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔧 Fixing 'record_audit_log' function to handle tables without 'id'...")

        cur.execute("""
        CREATE OR REPLACE FUNCTION record_audit_log()
        RETURNS TRIGGER AS $$
        DECLARE
            v_old_data JSONB;
            v_new_data JSONB;
            v_summary TEXT;
            v_user_id UUID;
            v_tenant_id INTEGER;
            v_record_id INTEGER;
        BEGIN
            -- Get Current User ID safely
            BEGIN
                v_user_id := auth.uid();
            EXCEPTION WHEN OTHERS THEN
                v_user_id := NULL;
            END;

            -- Prepare Data
            IF (TG_OP = 'DELETE') THEN
                v_old_data := to_jsonb(OLD);
                v_new_data := NULL;
                v_summary := 'Deleted record';
            ELSIF (TG_OP = 'INSERT') THEN
                v_old_data := NULL;
                v_new_data := to_jsonb(NEW);
                v_summary := 'Created record';
            ELSE
                v_old_data := to_jsonb(OLD);
                v_new_data := to_jsonb(NEW);
                v_summary := 'Updated record';
            END IF;
            
            -- Extract Tenant ID safely (using JSONB to avoid "no field" errors)
            v_tenant_id := COALESCE(
                (to_jsonb(NEW)->>'tenant_id')::integer,
                (to_jsonb(OLD)->>'tenant_id')::integer
            );
            
            -- Extract Record ID safely
            -- We use JSONB extraction because accessing NEW.id directly throws an error
            -- if the table does not have an 'id' column.
            v_record_id := COALESCE(
                (to_jsonb(NEW)->>'id')::integer,
                (to_jsonb(OLD)->>'id')::integer
            );

            INSERT INTO audit_logs (table_name, record_id, operation, changed_by, old_values, new_values, record_summary, tenant_id)
            VALUES (
                TG_TABLE_NAME,
                v_record_id, -- Can be NULL if table has no ID
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
        print("✅ Function updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    fix_audit_function()
