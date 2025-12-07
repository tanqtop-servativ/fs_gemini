-- Drop all variations of update_property_safe to fix ambiguity

DROP FUNCTION IF EXISTS public.update_property_safe(uuid,text,text,text,text,time without time zone,time without time zone,uuid[],uuid[],text,text,text,text,text,text,text,integer,numeric,integer,boolean,boolean,boolean,text,boolean,text,integer,integer,integer,text,boolean,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.update_property_safe(uuid,text,text,text,text,time without time zone,time without time zone,uuid[],uuid[],text,text,text,text,text,text,text,integer,numeric,integer,boolean,boolean,boolean,text,boolean,text,integer,integer,integer,text,boolean,boolean,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.update_property_safe(uuid,uuid,text,text,text,text,time without time zone,time without time zone,uuid[],uuid[],text,text,text,text,text,text,text,integer,numeric,integer,boolean,boolean,boolean,text,boolean,text,integer,integer,integer,text,boolean,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.update_property_safe(uuid,uuid,text,text,text,text,time without time zone,time without time zone,uuid[],uuid[],text,text,text,text,text,text,text,integer,numeric,integer,boolean,boolean,boolean,text,boolean,text,integer,integer,integer,text,boolean,boolean,jsonb,jsonb);

-- Recreate the correct version (with tenant_id, without is_active)
CREATE OR REPLACE FUNCTION public.update_property_safe(
    p_id uuid,
    p_tenant_id uuid,
    p_name text, 
    p_address text, 
    p_hcp_cust text, 
    p_hcp_addr text, 
    p_checkin time without time zone, 
    p_checkout time without time zone, 
    p_owner_ids uuid[], 
    p_manager_ids uuid[], 
    p_photo_url text, 
    p_door_code text, 
    p_garage_code text, 
    p_gate_code text, 
    p_closet_code text, 
    p_wifi_network text,
    p_wifi_password text,
    p_bedrooms integer,
    p_bathrooms numeric,
    p_max_guests integer,
    p_has_pool boolean,
    p_has_bbq boolean,
    p_allows_pets boolean,
    p_parking_instructions text,
    p_has_casita boolean,
    p_casita_code text,
    p_square_footage integer,
    p_bathroom_sinks integer,
    p_bath_mats integer,
    p_time_zone text,
    p_is_dst boolean,
    p_feeds jsonb DEFAULT '[]'::jsonb, 
    p_inventory jsonb DEFAULT '[]'::jsonb
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  feed_item JSONB;
  inv_item JSONB;
  pid UUID;
  f_id UUID;
  feed_ids_to_keep UUID[] := '{}';
  role_owner_id UUID;
  role_manager_id UUID;
BEGIN
    -- Get Role IDs
    SELECT id INTO role_owner_id FROM roles WHERE name = 'Owner';
    SELECT id INTO role_manager_id FROM roles WHERE name = 'Property Manager';

    UPDATE properties 
    SET name = p_name, address = p_address, hcp_customer_id = p_hcp_cust, hcp_address_id = p_hcp_addr, 
        check_in_time = p_checkin, check_out_time = p_checkout, front_photo_url = p_photo_url,
        wifi_network = p_wifi_network, wifi_password = p_wifi_password,
        bedrooms = p_bedrooms, bathrooms = p_bathrooms, max_guests = p_max_guests,
        has_pool = p_has_pool, has_bbq = p_has_bbq, allows_pets = p_allows_pets,
        parking_instructions = p_parking_instructions,
        has_casita = p_has_casita, square_footage = p_square_footage,
        bathroom_sinks = p_bathroom_sinks, bath_mats = p_bath_mats,
        time_zone = p_time_zone, is_dst = p_is_dst
    WHERE id = p_id;

    DELETE FROM property_assignments WHERE property_id = p_id;
    
    IF p_owner_ids IS NOT NULL THEN
        FOREACH pid IN ARRAY p_owner_ids LOOP
            INSERT INTO property_assignments (property_id, person_id, role_id) VALUES (p_id, pid, role_owner_id);
        END LOOP;
    END IF;

    IF p_manager_ids IS NOT NULL THEN
        FOREACH pid IN ARRAY p_manager_ids LOOP
            IF NOT EXISTS (SELECT 1 FROM property_assignments WHERE property_id = p_id AND person_id = pid) THEN
                INSERT INTO property_assignments (property_id, person_id, role_id) VALUES (p_id, pid, role_manager_id);
            END IF;
        END LOOP;
    END IF;

    -- Codes
    DELETE FROM property_access_codes WHERE property_id = p_id AND code_type IN ('Door', 'Garage', 'Community Gate', 'Owner Closet', 'Casita');
    IF p_door_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Door', p_door_code); END IF;
    IF p_garage_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Garage', p_garage_code); END IF;
    IF p_gate_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Community Gate', p_gate_code); END IF;
    IF p_closet_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Owner Closet', p_closet_code); END IF;
    IF p_casita_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Casita', p_casita_code); END IF;

    -- Feeds (Smart Update)
    IF p_feeds IS NOT NULL THEN
        FOR feed_item IN SELECT * FROM jsonb_array_elements(p_feeds) LOOP
            f_id := (feed_item->>'id')::UUID;
            
            IF f_id IS NOT NULL THEN
                -- Update existing
                UPDATE calendar_feeds SET name = feed_item->>'name', url = feed_item->>'url' WHERE id = f_id;
                feed_ids_to_keep := array_append(feed_ids_to_keep, f_id);
            ELSE
                -- Insert new
                INSERT INTO calendar_feeds (property_id, name, url) VALUES (p_id, feed_item->>'name', feed_item->>'url') RETURNING id INTO f_id;
                feed_ids_to_keep := array_append(feed_ids_to_keep, f_id);
            END IF;
        END LOOP;
    END IF;

    -- Delete removed feeds (only those NOT in the keep list)
    DELETE FROM calendar_feeds WHERE property_id = p_id AND NOT (id = ANY(feed_ids_to_keep));

    -- Inventory
    DELETE FROM property_inventory WHERE property_id = p_id;
    IF p_inventory IS NOT NULL THEN
        FOR inv_item IN SELECT * FROM jsonb_array_elements(p_inventory) LOOP
            INSERT INTO property_inventory (property_id, item_name, quantity, category) 
            VALUES (p_id, inv_item->>'name', (inv_item->>'qty')::INT, inv_item->>'category');
        END LOOP;
    END IF;
END;
$function$;
