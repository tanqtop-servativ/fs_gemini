import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

# 1. Add column
sql_add_col = """
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS changed_by uuid;
"""

# 2. Update Trigger Function
sql_update_func = """
CREATE OR REPLACE FUNCTION public.record_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, operation, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
        RETURN NEW;
    
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only log if something actually changed
        IF NEW IS DISTINCT FROM OLD THEN
            INSERT INTO audit_logs (table_name, record_id, operation, old_values, new_values, changed_by)
            VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
        END IF;
        RETURN NEW;
    
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, operation, old_values, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;
"""

# 3. Update View
# We need to drop and recreate because we are changing columns
sql_update_view = """
DROP VIEW IF EXISTS audit_history_view;

CREATE OR REPLACE VIEW audit_history_view AS
SELECT 
    id,
    table_name,
    record_id,
    operation,
    changed_at,
    changed_by,
    old_values,
    new_values,
    CASE
        WHEN operation = 'INSERT' THEN 'Created record'
        WHEN operation = 'DELETE' THEN 'Deleted record'
        WHEN operation = 'UPDATE' THEN 
            'Updated fields: ' || (
                SELECT string_agg(key, ', ')
                FROM jsonb_each(new_values)
                WHERE new_values -> key IS DISTINCT FROM old_values -> key
            )
        ELSE operation
    END AS description
FROM audit_logs;

GRANT SELECT ON audit_history_view TO anon, authenticated, service_role;
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Adding 'changed_by' column...")
    cur.execute(sql_add_col)
    
    print("Updating trigger function...")
    cur.execute(sql_update_func)
    
    print("Updating audit_history_view...")
    cur.execute(sql_update_view)
    
    conn.commit()
    print("✅ Database updates complete.")
            
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
