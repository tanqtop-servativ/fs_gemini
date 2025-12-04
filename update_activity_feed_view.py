import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def update_activity_feed_view():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()

        print("Updating tenant_activity_feed view...")
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
                (new_values->>'tenant_id')::integer, 
                (old_values->>'tenant_id')::integer,
                (SELECT tenant_id FROM profiles WHERE id = changed_by)
            ) AS tenant_id,
            changed_at AS timestamp,
            'DATA_CHANGE' AS category,
            'INFO' AS severity,
            CASE 
                WHEN record_summary IS NOT NULL THEN record_summary || ' (' || operation || ')'
                ELSE operation || ' on ' || table_name 
            END AS summary,
            jsonb_build_object(
                'table', table_name,
                'operation', operation,
                'old', old_values,
                'new', new_values,
                'record_summary', record_summary
            ) AS details,
            changed_by AS actor_id,
            (SELECT email FROM auth.users WHERE id = changed_by) AS actor_email
        FROM audit_logs
        WHERE table_name != 'communications';
        """)

        conn.commit()
        print("✅ tenant_activity_feed view updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    update_activity_feed_view()
