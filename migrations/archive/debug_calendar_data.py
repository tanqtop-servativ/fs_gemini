
import os
import psycopg2

def check_calendar_data():
    conn_str = os.environ.get('DB_CONNECTION_STRING')
    if not conn_str:
        # Fallback to loading .env
        try:
            with open('.env', 'r') as f:
                for line in f:
                    if line.startswith('DB_CONNECTION_STRING='):
                        conn_str = line.split('=', 1)[1].strip().strip("'").strip('"')
                        break
        except:
             pass

    if not conn_str:
        print("No connection string")
        return

    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        
        prop_id = '30ac7e0d-58f8-4a07-a4c9-f51d45525f8e'
        print(f"Checking events for property: {prop_id}")
        
        # Check bookings
        cur.execute(f"SELECT count(*) FROM bookings WHERE property_id = '{prop_id}'")
        bookings = cur.fetchone()[0]
        print(f"Bookings: {bookings}")
        
        # Check service_opportunities
        cur.execute(f"SELECT count(*) FROM service_opportunities WHERE property_id = '{prop_id}'")
        opps = cur.fetchone()[0]
        print(f"Service Opps: {opps}")
        
        # Check master_calendar view
        cur.execute(f"SELECT count(*) FROM master_calendar WHERE property_id = '{prop_id}'")
        master = cur.fetchone()[0]
        print(f"Master Calendar View Count: {master}")

        cur.close()
        conn.close()
    except Exception as e:
        print(e)

if __name__ == "__main__":
    check_calendar_data()
