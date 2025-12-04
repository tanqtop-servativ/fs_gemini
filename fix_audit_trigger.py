import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

SQL = """
CREATE OR REPLACE FUNCTION public.record_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
        DECLARE
            v_user_id UUID;
            v_old_data JSONB;
            v_new_data JSONB;
            v_record_id BIGINT;
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
                v_record_id := OLD.id;
            ELSIF (TG_OP = 'INSERT') THEN
                v_old_data := null;
                v_new_data := to_jsonb(NEW);
                v_record_id := NEW.id;
            ELSE
                v_old_data := to_jsonb(OLD);
                v_new_data := to_jsonb(NEW);
                v_record_id := NEW.id;
            END IF;

            INSERT INTO audit_logs (table_name, record_id, operation, changed_by, old_values, new_values)
            VALUES (
                TG_TABLE_NAME,
                v_record_id,
                TG_OP,
                v_user_id,
                v_old_data,
                v_new_data
            );
            
            RETURN COALESCE(NEW, OLD);
        END;
        $function$;
"""

def fix_trigger():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        print("Updating record_audit_log function...")
        cur.execute(SQL)
        conn.commit()
        print("✅ Function updated successfully.")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    fix_trigger()
