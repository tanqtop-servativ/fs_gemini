
import os
import psycopg2

DB_CONNECTION_STRING = os.environ.get('DB_CONNECTION_STRING')
if not DB_CONNECTION_STRING:
    print("DB_CONNECTION_STRING not set")
    exit(1)

def inspect_columns(table):
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}';")
        cols = [r[0] for r in cur.fetchall()]
        print(f"Columns for {table}: {cols}")
        if 'deleted_at' in cols:
            print(f"✅ {table} has deleted_at")
        else:
            print(f"❌ {table} MISSING deleted_at")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    inspect_columns('bookings')
    inspect_columns('service_opportunities')
