-- Update master_calendar view to show JOBS instead of Service Opportunities
-- Jobs inherit date from their parent Service Opportunity

CREATE OR REPLACE VIEW master_calendar AS
SELECT 
    b.id::text as id,
    b.property_id,
    p.name as property_name,
    p.address as property_address,
    COALESCE(b.guest_name, b.ical_summary, 'Booking') as title,
    b.start_date::timestamp as start_date,
    b.end_date::timestamp as end_date,
    'Booking' as event_type,
    CASE 
        WHEN cf.id IS NOT NULL THEN 
            CASE 
                WHEN lower(cf.name) LIKE '%airbnb%' OR lower(cf.url) LIKE '%airbnb%' THEN '#FF5A5F' -- Airbnb Pink
                WHEN lower(cf.name) LIKE '%vrbo%' OR lower(cf.url) LIKE '%vrbo%' THEN '#3b82f6' -- VRBO Blue
                ELSE '#f97316' -- Other Feeds: Orange
            END
        WHEN b.status = 'confirmed' THEN '#22c55e' -- Manual Booking: Green
        WHEN b.status = 'pending' THEN '#f59e0b'
        WHEN b.status = 'cancelled' THEN '#ef4444'
        ELSE '#6b7280'
    END as color,
    '' as class_name,
    true as all_day,
    COALESCE(b.ical_summary, b.status) as description,
    '' as code,
    b.tenant_id
FROM bookings b
JOIN properties p ON p.id = b.property_id
LEFT JOIN calendar_feeds cf ON cf.id = b.feed_id
WHERE b.status != 'cancelled'

UNION ALL

SELECT 
    j.id::text as id,
    j.property_id,
    p.name as property_name,
    p.address as property_address,
    COALESCE(j.title, 'Job') as title,
    so.due_date::timestamp as start_date,
    (so.due_date + interval '1 hour')::timestamp as end_date,
    'Job' as event_type,
    CASE 
        WHEN j.status = 'Completed' THEN '#10b981' -- Emerald
        WHEN j.status = 'Pending' THEN '#8b5cf6' -- Violet
        ELSE '#6366f1' -- Indigo
    END as color,
    '' as class_name,
    false as all_day,
    j.description,
    '' as code,
    j.tenant_id
FROM jobs j
JOIN service_opportunities so ON so.id = j.service_opportunity_id
JOIN properties p ON p.id = j.property_id
WHERE j.deleted_at IS NULL 
  AND so.deleted_at IS NULL
  AND j.status NOT IN ('Cancelled', 'Dismissed');
