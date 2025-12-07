
import os
import psycopg2

DB_CONNECTION_STRING = os.environ.get('DB_CONNECTION_STRING')

def apply_migration():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        with open('migrations/update_master_calendar_view_v4.sql', 'r') as f:
            sql = f.read()
            
        cur.execute(sql)
        conn.commit()
        print("✅ Successfully applied master_calendar view v4 (Jobs Only)")
        
    except Exception as e:
        print(f"Error: {e}")
        if conn: conn.rollback()
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    apply_migration()
