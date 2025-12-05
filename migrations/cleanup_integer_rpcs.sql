-- Cleanup Integer RPCs and replace with UUID versions

-- 1. DROP Incorrect Integer Functions (Dynamic DO Block)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure as sig
        FROM pg_proc
        WHERE proname IN ('delete_property_safe', 'delete_tenant', 'manage_tenant_user', 'sync_ical_data', 'update_tenant', 'create_property_safe', 'update_property_safe')
        AND (
            pg_get_function_arguments(oid) LIKE '%p_id integer%' 
            OR pg_get_function_arguments(oid) LIKE '%p_tenant_id integer%'
            OR pg_get_function_arguments(oid) LIKE '%p_feed_id integer%'
            OR pg_get_function_arguments(oid) LIKE '%p_owner_id integer%'
            OR pg_get_function_arguments(oid) LIKE '%p_manager_id integer%'
            OR pg_get_function_arguments(oid) LIKE '%p_owner_ids integer[]%'
            OR pg_get_function_arguments(oid) LIKE '%p_manager_ids integer[]%'
        )
    LOOP
        RAISE NOTICE 'Dropping routine: %', r.sig;
        EXECUTE 'DROP ROUTINE IF EXISTS ' || r.sig;
    END LOOP;
END $$;


-- 2. RECREATE Functions with UUIDs

-- delete_property_safe
CREATE OR REPLACE FUNCTION public.delete_property_safe(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Mark the Property as 'archived' (Soft Delete)
    UPDATE properties
    SET status = 'archived'
    WHERE id = p_id;
END;
$function$;

-- delete_tenant
CREATE OR REPLACE FUNCTION public.delete_tenant(p_tenant_id uuid, p_acting_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Set acting user for audit
    IF p_acting_user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_acting_user_id::text, true);
    END IF;

    UPDATE tenants SET is_active = false WHERE id = p_tenant_id;
END;
$function$;

-- manage_tenant_user
CREATE OR REPLACE FUNCTION public.manage_tenant_user(
    p_operation text, 
    p_tenant_id uuid, 
    p_user_id uuid DEFAULT NULL::uuid, 
    p_email text DEFAULT NULL::text, 
    p_password text DEFAULT NULL::text, 
    p_first text DEFAULT NULL::text, 
    p_last text DEFAULT NULL::text, 
    p_acting_user_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_new_id UUID;
    v_person_id UUID;
    v_role_id UUID;
BEGIN
    -- Set acting user for audit
    IF p_acting_user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_acting_user_id::text, true);
    END IF;

    IF p_operation = 'CREATE' THEN
        -- Create User
        INSERT INTO app_users (email, password_hash, tenant_id, is_superuser, first_name, last_name)
        VALUES (p_email, p_password, p_tenant_id, false, p_first, p_last)
        RETURNING id INTO v_new_id;

        -- Create Person
        INSERT INTO people (tenant_id, first_name, last_name, email)
        VALUES (p_tenant_id, p_first, p_last, p_email)
        RETURNING id INTO v_person_id;

        -- Assign Role
        SELECT id INTO v_role_id FROM roles WHERE name = 'Manager';
        INSERT INTO person_roles (person_id, role_id) VALUES (v_person_id, v_role_id);
        
        RETURN jsonb_build_object('success', true, 'id', v_new_id);

    ELSIF p_operation = 'UPDATE' THEN
        UPDATE app_users 
        SET email = COALESCE(p_email, email),
            first_name = COALESCE(p_first, first_name),
            last_name = COALESCE(p_last, last_name),
            password_hash = CASE WHEN p_password IS NOT NULL AND p_password <> '' THEN p_password ELSE password_hash END
        WHERE id = p_user_id;

        -- Also update person? (Optional, but good practice)
        UPDATE people
        SET first_name = COALESCE(p_first, first_name),
            last_name = COALESCE(p_last, last_name),
            email = COALESCE(p_email, email)
        WHERE email = (SELECT email FROM app_users WHERE id = p_user_id); -- Heuristic link
        
        RETURN jsonb_build_object('success', true);

    ELSIF p_operation = 'DELETE' THEN
        DELETE FROM app_users WHERE id = p_user_id;
        -- We don't delete the person record automatically to preserve history, or we could.
        RETURN jsonb_build_object('success', true);
    END IF;
    
    RETURN jsonb_build_object('success', false, 'error', 'Invalid operation');
END;
$function$;

-- sync_ical_data
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
  v_service_job_id BIGINT;
  
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
      -- A. Create Booking
      INSERT INTO bookings (property_id, feed_id, uid, start_date, end_date, status, ical_summary)
      VALUES (v_prop_id, p_feed_id, v_uid, v_booking_start, v_booking_end, 'CONFIRMED', event_record->>'summary')
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

-- update_tenant
CREATE OR REPLACE FUNCTION public.update_tenant(p_tenant_id uuid, p_name text, p_acting_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Set acting user for audit
    IF p_acting_user_id IS NOT NULL THEN
        PERFORM set_config('app.current_user_id', p_acting_user_id::text, true);
    END IF;

    UPDATE tenants SET name = p_name WHERE id = p_tenant_id;
END;
$function$;
