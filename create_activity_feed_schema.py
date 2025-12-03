import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv("DB_CONNECTION_STRING")

SQL_COMMANDS = [
    # 1. Create Communications Table
    """
    CREATE TABLE IF NOT EXISTS communications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER NOT NULL REFERENCES tenants(id),
        type TEXT NOT NULL CHECK (type IN ('EMAIL', 'SMS', 'SYSTEM_ALERT')),
        direction TEXT NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
        recipient TEXT,
        subject TEXT,
        content TEXT,
        status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'DELIVERED', 'FAILED', 'QUEUED')),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        created_by UUID DEFAULT auth.uid()
    );
    """,
    
    # 2. Enable RLS on Communications
    "ALTER TABLE communications ENABLE ROW LEVEL SECURITY;",
    
    # 3. RLS Policy for Communications (Tenant Isolation)
    """
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'communications' AND policyname = 'Tenant Isolation'
        ) THEN
            CREATE POLICY "Tenant Isolation" ON communications
            USING (
                tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
                OR 
                (SELECT is_superuser FROM profiles WHERE id = auth.uid()) = true
            );
        END IF;
    END $$;
    """,

    # 4. Create Unified Activity Feed View
    """
    CREATE OR REPLACE VIEW tenant_activity_feed AS
    SELECT
        id::text AS event_id,
        tenant_id,
        created_at AS timestamp,
        'COMMUNICATION' AS category,
        CASE 
            WHEN status = 'FAILED' THEN 'ERROR'
            ELSE 'INFO'
        END AS severity,
        COALESCE(subject, 'Message to ' || recipient) AS summary,
        jsonb_build_object(
            'type', type,
            'direction', direction,
            'recipient', recipient,
            'content', content,
            'status', status
        ) AS details,
        created_by AS actor_id,
        (SELECT email FROM auth.users WHERE id = created_by) AS actor_email
    FROM communications

    UNION ALL

    SELECT
        id::text AS event_id,
        COALESCE(
            (new_values->>'tenant_id')::integer, 
            (old_values->>'tenant_id')::integer,
            (SELECT tenant_id FROM profiles WHERE id = changed_by)
        ) AS tenant_id,
        changed_at AS timestamp,
        'DATA_CHANGE' AS category,
        'INFO' AS severity,
        operation || ' on ' || table_name AS summary,
        jsonb_build_object(
            'table', table_name,
            'operation', operation,
            'old', old_values,
            'new', new_values
        ) AS details,
        changed_by AS actor_id,
        (SELECT email FROM auth.users WHERE id = changed_by) AS actor_email
    FROM audit_logs
    WHERE table_name != 'communications'; -- Avoid double counting if we audit comms
    """,
    
    # 5. Grant Access to View
    "GRANT SELECT ON tenant_activity_feed TO authenticated, service_role;"
]

def run_migration():
    try:
        conn = psycopg2.connect(DB_STRING)
        cur = conn.cursor()
        
        print("🚀 Starting Schema Migration for Activity Feed...")
        
        for cmd in SQL_COMMANDS:
            try:
                cur.execute(cmd)
                print(f"✅ Executed: {cmd[:50].strip()}...")
            except Exception as e:
                print(f"❌ Error executing: {cmd[:50]}...\n{e}")
                conn.rollback()
                return

        conn.commit()
        print("🎉 Migration Complete!")

    except Exception as e:
        print(f"❌ Connection Error: {e}")
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == "__main__":
    run_migration()
