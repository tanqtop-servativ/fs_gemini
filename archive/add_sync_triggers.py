import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def add_triggers():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("Adding sync triggers...")

        # Trigger 1: Sync Kitting to Field
        cur.execute("""
            CREATE OR REPLACE FUNCTION sync_kitting_to_field()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Only proceed if type is Kitting
                IF NEW.type = 'Kitting' THEN
                    UPDATE jobs
                    SET metadata = metadata || jsonb_build_object(
                        'kitting_status', NEW.status,
                        'kitting_shelf', NEW.metadata->>'shelf',
                        'kitting_bags', NEW.metadata->>'bags',
                        'kitting_color', NEW.metadata->>'color'
                    )
                    WHERE dependency_job_id = NEW.id;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_sync_kitting ON jobs;
            CREATE TRIGGER trg_sync_kitting
            AFTER UPDATE ON jobs
            FOR EACH ROW
            EXECUTE FUNCTION sync_kitting_to_field();
        """)

        # Trigger 2: Sync Field to Inspection (Assuming Inspection depends on Field)
        # Note: The current RPC doesn't create Inspection jobs yet, but we can add the trigger logic for future.
        # Or if there is an inspection job linked.
        
        cur.execute("""
            CREATE OR REPLACE FUNCTION sync_field_to_downstream()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Only proceed if type is Field
                IF NEW.type = 'Field' THEN
                    UPDATE jobs
                    SET metadata = metadata || jsonb_build_object(
                        'field_job_status', NEW.status
                    )
                    WHERE dependency_job_id = NEW.id;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_sync_field ON jobs;
            CREATE TRIGGER trg_sync_field
            AFTER UPDATE ON jobs
            FOR EACH ROW
            EXECUTE FUNCTION sync_field_to_downstream();
        """)

        conn.commit()
        print("✅ Sync triggers added successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    add_triggers()
