
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_schema():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔹 Table: property_reference_photos columns:")
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'property_reference_photos'
            ORDER BY ordinal_position;
        """)
        columns = cur.fetchall()
        for col in columns:
            print(f"   - {col[0]} ({col[1]}), Nullable: {col[2]}, Default: {col[3]}")

        print("\n🔹 Triggers on property_reference_photos:")
        cur.execute("""
            SELECT trigger_name, event_manipulation, action_statement, action_timing
            FROM information_schema.triggers
            WHERE event_object_table = 'property_reference_photos';
        """)
        triggers = cur.fetchall()
        if not triggers:
            print("   (No triggers found via information_schema - checking pg_trigger for more details if needed)")
        else:
            for trig in triggers:
                print(f"   - {trig[0]}: {trig[3]} {trig[1]}")

        # Also check for policies if RLS is enabled, but that's harder to see via simple query sometimes. 
        # But usually failures are NOT RLS if the user is admin (which the key usually is service role, but frontend is user).
        # We are testing frontend failure.
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    inspect_schema()
