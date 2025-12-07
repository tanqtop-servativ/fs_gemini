
-- 1. Fix service_jobs table
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id);
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id);
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS access_codes_snapshot JSONB DEFAULT '[]'::jsonb;
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS inventory_checklist JSONB DEFAULT '[]'::jsonb;

-- 2. Fix job_queue table
ALTER TABLE job_queue ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id);

-- 3. Fix sync_ical_data function (Correct v_service_job_id type to UUID)
CREATE OR REPLACE FUNCTION public.sync_ical_data(p_feed_id uuid, p_events jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  event_record JSONB;
  v_uid TEXT;
  v_prop_id UUID;
  v_feed_name TEXT;
  v_tenant_id UUID; 
  
  -- IDs
  v_booking_id UUID;
  v_existing_booking_id UUID;
  v_service_job_id UUID; -- FIXED: Changed from BIGINT to UUID
  
  -- Data
  v_booking_start TIMESTAMPTZ;
  v_booking_end TIMESTAMPTZ;
  v_job_start TIMESTAMPTZ;
  v_job_end TIMESTAMPTZ;
  
  -- Snapshots
  v_codes_json JSONB;
  v_inventory_json JSONB;
  
  -- HCP Helpers
  v_prop_name TEXT;
  v_booking_str TEXT;
BEGIN
  -- 1. Setup Context with Safety Net
  -- Using Admin Tenant ID as fallback: 3e677c58-867f-4a58-93c0-609129038cb9
  SELECT 
    property_id, 
    name, 
    COALESCE((SELECT tenant_id FROM properties WHERE id = calendar_feeds.property_id), '3e677c58-867f-4a58-93c0-609129038cb9'::uuid) 
  INTO v_prop_id, v_feed_name, v_tenant_id
  FROM calendar_feeds WHERE id = p_feed_id;

  -- Get Prop Name
  SELECT name INTO v_prop_name FROM properties WHERE id = v_prop_id;

  -- 2. Snapshot Data
  SELECT jsonb_agg(jsonb_build_object('type', code_type, 'code', code_value))
  INTO v_codes_json FROM property_access_codes WHERE property_id = v_prop_id;

  SELECT jsonb_agg(jsonb_build_object('name', item_name, 'qty', quantity))
  INTO v_inventory_json FROM property_inventory WHERE property_id = v_prop_id;

  -- 3. Loop Events
  FOR event_record IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    v_uid := event_record->>'uid';
    v_booking_start := (event_record->>'start')::TIMESTAMPTZ;
    v_booking_end := (event_record->>'end')::TIMESTAMPTZ;
    v_job_start := v_booking_end + INTERVAL '11 hours'; 
    v_job_end   := v_booking_end + INTERVAL '15 hours';
    v_booking_str := to_char(v_booking_start, 'Mon DD') || ' - ' || to_char(v_booking_end, 'Mon DD');

    -- Check Existence
    SELECT id INTO v_existing_booking_id FROM bookings WHERE property_id = v_prop_id AND uid = v_uid;

    IF v_existing_booking_id IS NULL THEN
      -- A. Create Booking (Using lowercase 'confirmed' for view compatibility)
      INSERT INTO bookings (property_id, feed_id, uid, start_date, end_date, status, ical_summary)
      VALUES (v_prop_id, p_feed_id, v_uid, v_booking_start, v_booking_end, 'confirmed', event_record->>'summary')
      RETURNING id INTO v_booking_id;

      -- B. Create INTERNAL JOB (Using the safe v_tenant_id)
      INSERT INTO service_jobs (
        tenant_id, property_id, booking_id, status, 
        scheduled_start, scheduled_end, 
        access_codes_snapshot, inventory_checklist
      )
      VALUES (
        v_tenant_id, v_prop_id, v_booking_id, 'scheduled',
        v_job_start, v_job_end,
        COALESCE(v_codes_json, '[]'::jsonb), COALESCE(v_inventory_json, '[]'::jsonb)
      )
      RETURNING id INTO v_service_job_id;

      -- C. Queue "Job Creation"
      INSERT INTO job_queue (booking_id, action_type, payload)
      VALUES (v_booking_id, 'CREATE_JOB', jsonb_build_object(
        'internal_job_id', v_service_job_id,
        'description', 'Turnover: ' || v_prop_name || ' (' || v_booking_str || ')'
      ));
    END IF;
  END LOOP;
END;
$function$;
