
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def inspect_feeds():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🔹 Checking calendar_feeds table...")
        cur.execute("SELECT COUNT(*) FROM calendar_feeds;")
        count = cur.fetchone()[0]
        print(f"   Total rows: {count}")
        
        if count > 0:
            print("   First 5 rows:")
            cur.execute("SELECT * FROM calendar_feeds LIMIT 5;")
            rows = cur.fetchall()
            for row in rows:
                print(f"   - {row}")

        print("\n🔹 Checking properties with feeds...")
        cur.execute("""
            SELECT p.id, p.name, COUNT(cf.id) as feed_count 
            FROM properties p 
            LEFT JOIN calendar_feeds cf ON p.id = cf.property_id 
            GROUP BY p.id, p.name 
            HAVING COUNT(cf.id) > 0;
        """)
        props = cur.fetchall()
        for p in props:
            print(f"   - Property '{p[1]}' ({p[0]}) has {p[2]} feeds")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if conn: conn.close()

if __name__ == "__main__":
    inspect_feeds()
