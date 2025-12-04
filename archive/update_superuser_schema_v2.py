import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

# 1. Add is_active column
sql_alter_table = """
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
"""

# 2. Add Audit Trigger (assuming record_audit_log function exists)
sql_audit_trigger = """
DROP TRIGGER IF EXISTS audit_log_trigger ON tenants;
CREATE TRIGGER audit_log_trigger
AFTER INSERT OR UPDATE OR DELETE ON tenants
FOR EACH ROW EXECUTE FUNCTION record_audit_log();
"""

# 3. Update delete_tenant to Soft Delete
sql_soft_delete = """
CREATE OR REPLACE FUNCTION public.delete_tenant(p_tenant_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Soft Delete: Set is_active to false
    UPDATE tenants 
    SET is_active = false 
    WHERE id = p_tenant_id;
    
    -- Optional: We could also soft-delete users/properties if they had is_active flags,
    -- but for now we just mark the tenant as inactive.
    -- The app should filter out inactive tenants.
END;
$function$;
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Adding 'is_active' to 'tenants'...")
    cur.execute(sql_alter_table)
    
    print("Adding audit trigger to 'tenants'...")
    cur.execute(sql_audit_trigger)
    
    print("Updating 'delete_tenant' RPC to Soft Delete...")
    cur.execute(sql_soft_delete)
    
    conn.commit()
    print("✅ Schema updated successfully.")
            
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
