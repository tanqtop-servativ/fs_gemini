import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

def update_view():
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        cur = conn.cursor()
        
        print("🚀 Updating master_calendar view...")

        cur.execute("DROP VIEW IF EXISTS master_calendar;")

        # We want to combine Bookings (Guest Stays) and Jobs (Service Work)
        # For Jobs, we use scheduled_at. If null, maybe use due_date (all day)?
        # For now, let's focus on scheduled jobs.
        
        cur.execute("""
            CREATE OR REPLACE VIEW master_calendar AS
            
            -- 1. BOOKINGS (Guest Stays)
            SELECT 
                'booking_' || b.id AS id,
                b.property_id,
                b.start_date,
                b.end_date,
                COALESCE(b.ical_summary, 'Guest Stay') AS title,
                '#3b82f6' AS color, -- Blue
                'booking' AS type,
                TRUE AS all_day,
                b.ical_description AS description,
                b.confirmation_code AS code,
                p.name AS property_name,
                p.display_address AS property_address,
                NULL AS assignee_name
            FROM bookings b
            JOIN properties p ON b.property_id = p.id
            WHERE b.status != 'CANCELLED'

            UNION ALL

            -- 2. JOBS (Service Work)
            SELECT 
                'job_' || j.id AS id,
                so.property_id,
                COALESCE(j.scheduled_at, so.due_date, j.created_at) AS start_date,
                -- Default duration 2 hours if not set? Or just same as start?
                COALESCE(j.scheduled_at, so.due_date, j.created_at) + INTERVAL '2 hours' AS end_date,
                st.name || ' - ' || j.type AS title,
                CASE 
                    WHEN j.type = 'Cleaning' THEN '#ec4899' -- Pink
                    WHEN j.type = 'Inspection' THEN '#a855f7' -- Purple
                    WHEN j.type = 'Kitting' THEN '#eab308' -- Yellow
                    ELSE '#6b7280' -- Gray
                END AS color,
                'job' AS type,
                (j.scheduled_at IS NULL) AS all_day, -- If no specific time, make it all day
                j.status AS description,
                j.type AS code,
                p.name AS property_name,
                p.display_address AS property_address,
                NULL AS assignee_name -- TODO: Join with profiles if assigned_to exists
            FROM jobs j
            JOIN service_opportunities so ON j.service_opportunity_id = so.id
            JOIN properties p ON so.property_id = p.id
            LEFT JOIN service_templates st ON so.service_template_id = st.id
            WHERE j.status != 'Complete' -- Or show completed? Let's show all.
        """)
        
        conn.commit()
        print("✅ View updated successfully.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    update_view()
