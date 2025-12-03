import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def create_rpc():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Creating get_property_audit_history RPC...")
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
        print("✅ RPC get_property_audit_history created successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    create_rpc()
