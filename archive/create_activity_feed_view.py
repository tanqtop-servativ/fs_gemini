import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_view():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Creating Activity Feed Schema...")
        
        # 1. Create Communications Table (if not exists)
        # Note: We use UUID for tenant_id now.
        print("   Creating communications table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS communications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id),
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
        """)
        
        # 2. Enable RLS (idempotent-ish)
        print("   Enabling RLS on communications...")
        cur.execute("ALTER TABLE communications ENABLE ROW LEVEL SECURITY;")
        
        # 3. Create View
        print("   Creating tenant_activity_feed view...")
        cur.execute("DROP VIEW IF EXISTS tenant_activity_feed;")
        
        # Note: We cast tenant_id to UUID in the audit_logs section.
        # And we handle potential casting errors if old data exists (though we wiped data).
        
        cur.execute("""
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
                    (new_values->>'tenant_id')::uuid, 
                    (old_values->>'tenant_id')::uuid,
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
            WHERE table_name != 'communications';
        """)
        
        conn.commit()
        print("✅ Activity Feed Schema Created.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_view()
