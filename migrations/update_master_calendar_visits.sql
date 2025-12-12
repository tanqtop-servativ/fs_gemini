-- Update master_calendar view to use VISITS for job scheduling
-- Jobs should show on calendar based on their visit scheduled_start/scheduled_end times
-- Not on service_opportunities.due_date
-- Now includes job_id for navigation

CREATE OR REPLACE VIEW master_calendar AS
-- Bookings (unchanged)
SELECT 
    b.id::text as id,
    b.property_id,
    p.name as property_name,
    p.display_address as property_address,
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
    NULL::uuid as job_id,  -- Bookings don't have job_id
    b.tenant_id
FROM bookings b
JOIN properties p ON p.id = b.property_id
LEFT JOIN calendar_feeds cf ON cf.id = b.feed_id
WHERE b.status != 'cancelled'

UNION ALL

-- Jobs with scheduled visits
SELECT 
    v.id::text as id,   -- Use visit ID for uniqueness
    j.property_id,
    p.name as property_name,
    p.display_address as property_address,
    j.title as title,
    v.scheduled_start as start_date,
    COALESCE(v.scheduled_end, v.scheduled_start + interval '1 hour') as end_date,
    'Job' as event_type,
    CASE 
        WHEN v.status = 'Completed' THEN '#10b981' -- Emerald
        WHEN v.status = 'In Progress' THEN '#2563eb' -- Blue-600 (Active)
        WHEN v.status = 'Scheduled' THEN '#0ea5e9' -- Sky-500 (Planned)
        ELSE '#64748b' -- Slate-500 (Default)
    END as color,
    CASE
        WHEN j.status = 'Complete' THEN 'status-completed'
        WHEN v.status = 'Completed' THEN 'status-completed'
        WHEN v.status = 'In Progress' THEN 'status-started'
        ELSE ''
    END as class_name,
    false as all_day,
    j.description,
    '' as code,
    j.id as job_id,  -- Include job_id for navigation
    j.tenant_id
FROM visits v
JOIN jobs j ON j.id = v.job_id
JOIN properties p ON p.id = j.property_id
WHERE v.scheduled_start IS NOT NULL
  AND j.deleted_at IS NULL
  AND v.status NOT IN ('Cancelled', 'Aborted');
