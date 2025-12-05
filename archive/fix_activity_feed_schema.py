import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_STRING = os.getenv('DB_CONNECTION_STRING')

def run_fix():
    conn = psycopg2.connect(DB_STRING)
    cur = conn.cursor()
    try:
        print('🚀 Starting Activity Feed schema fix...')
        # 1. Alter communications.tenant_id to UUID
        print('Altering communications.tenant_id to UUID...')
        # Drop existing FK if exists
        cur.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
                           WHERE constraint_name = 'communications_tenant_id_fkey' 
                             AND table_name = 'communications') THEN
                    ALTER TABLE communications DROP CONSTRAINT communications_tenant_id_fkey;
                END IF;
            END $$;
        """)
        # Change column type
        cur.execute("""
            ALTER TABLE communications
            ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
        """)
        # Add FK constraint back
        cur.execute("""
            ALTER TABLE communications
            ADD CONSTRAINT communications_tenant_id_fkey
            FOREIGN KEY (tenant_id) REFERENCES tenants(id);
        """)
        # 2. Recreate tenant_activity_feed view with UUID handling
        print('Recreating tenant_activity_feed view...')
        sql_drop = "DROP VIEW IF EXISTS tenant_activity_feed;"
        sql_create = """
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
        """
        cur.execute(sql_drop)
        cur.execute(sql_create)
        # 3. Grant select
        cur.execute("GRANT SELECT ON tenant_activity_feed TO authenticated, service_role;")
        conn.commit()
        print('✅ Activity Feed schema fixed and view recreated.')
    except Exception as e:
        print('❌ Error during fix:', e)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    run_fix()
