
import os
import psycopg2

DB_CONNECTION_STRING = os.environ.get('DB_CONNECTION_STRING')
if not DB_CONNECTION_STRING:
    print("DB_CONNECTION_STRING not set")
    exit(1)

def apply_migration():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        with open('migrations/update_master_calendar_view_v2.sql', 'r') as f:
            sql = f.read()
            
        cur.execute(sql)
        conn.commit()
        print("✅ Successfully updated master_calendar view")
        
    except Exception as e:
        print(f"Error: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    apply_migration()
