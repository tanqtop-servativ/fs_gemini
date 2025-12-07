-- Create master_calendar view for the Calendar UI
-- Combines bookings and jobs into a unified calendar event list

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
    so.id::text as id,
    so.property_id,
    p.name as property_name,
    p.address as property_address,
    COALESCE(so.title, 'Service Opportunity') as title,
    so.due_date::timestamp as start_date,
    (so.due_date + interval '1 hour')::timestamp as end_date,
    'Service' as event_type,
    CASE 
        WHEN so.status = 'completed' THEN '#10b981' -- Emerald
        WHEN so.status = 'cancelled' THEN '#ef4444' -- Red
        ELSE '#8b5cf6' -- Violet for Open/In Progress
    END as color,
    '' as class_name,
    false as all_day,
    so.description,
    '' as code,
    so.tenant_id
FROM service_opportunities so
JOIN properties p ON p.id = so.property_id
WHERE so.status != 'archived';
