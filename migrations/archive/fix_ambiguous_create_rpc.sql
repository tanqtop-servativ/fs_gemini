-- Drop all variations of create_property_safe to fix ambiguity

DROP FUNCTION IF EXISTS public.create_property_safe(text,text,text,text,time without time zone,time without time zone,uuid[],uuid[],text,text,text,text,text,text,text,integer,numeric,integer,boolean,boolean,boolean,text,boolean,text,integer,integer,integer,text,boolean,jsonb,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.create_property_safe(uuid,text,text,text,text,time without time zone,time without time zone,uuid[],uuid[],text,text,text,text,text,text,text,integer,numeric,integer,boolean,boolean,boolean,text,boolean,text,integer,integer,integer,text,boolean,jsonb,jsonb,jsonb);
DROP FUNCTION IF EXISTS public.create_property_safe(uuid,text,text,text,text,time without time zone,time without time zone,uuid[],uuid[],text,text,text,text,text,text,text,integer,numeric,integer,boolean,boolean,boolean,text,boolean,text,integer,integer,integer,text,boolean,boolean,jsonb,jsonb,jsonb);

-- Recreate the correct version (with tenant_id, without is_active)
CREATE OR REPLACE FUNCTION public.create_property_safe(
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
    p_inventory jsonb DEFAULT '[]'::jsonb,
    p_attachments jsonb DEFAULT '[]'::jsonb
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_prop_id UUID;
  feed_item JSONB;
  inv_item JSONB;
  pid UUID;
  role_owner_id UUID;
  role_manager_id UUID;
BEGIN
    -- Get Role IDs
    SELECT id INTO role_owner_id FROM roles WHERE name = 'Owner';
    SELECT id INTO role_manager_id FROM roles WHERE name = 'Property Manager';

    INSERT INTO properties (
        tenant_id, name, address, hcp_customer_id, hcp_address_id, 
        check_in_time, check_out_time, front_photo_url, 
        wifi_network, wifi_password,
        bedrooms, bathrooms, max_guests, has_pool, has_bbq, allows_pets, parking_instructions,
        has_casita, square_footage,
        bathroom_sinks, bath_mats,
        time_zone, is_dst
    )
    VALUES (
        p_tenant_id, p_name, p_address, p_hcp_cust, p_hcp_addr, 
        p_checkin, p_checkout, p_photo_url,
        p_wifi_network, p_wifi_password,
        p_bedrooms, p_bathrooms, p_max_guests, p_has_pool, p_has_bbq, p_allows_pets, p_parking_instructions,
        p_has_casita, p_square_footage,
        p_bathroom_sinks, p_bath_mats,
        p_time_zone, p_is_dst
    )
    RETURNING id INTO new_prop_id;

    -- Assignments (Owners)
    IF p_owner_ids IS NOT NULL THEN
        FOREACH pid IN ARRAY p_owner_ids LOOP
            INSERT INTO property_assignments (property_id, person_id, role_id) VALUES (new_prop_id, pid, role_owner_id);
        END LOOP;
    END IF;

    -- Assignments (Managers)
    IF p_manager_ids IS NOT NULL THEN
        FOREACH pid IN ARRAY p_manager_ids LOOP
            INSERT INTO property_assignments (property_id, person_id, role_id) VALUES (new_prop_id, pid, role_manager_id);
        END LOOP;
    END IF;

    -- Access Codes
    IF p_door_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Door', p_door_code); END IF;
    IF p_garage_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Garage', p_garage_code); END IF;
    IF p_gate_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Community Gate', p_gate_code); END IF;
    IF p_closet_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Owner Closet', p_closet_code); END IF;
    IF p_casita_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Casita', p_casita_code); END IF;

    -- Calendar Feeds
    IF p_feeds IS NOT NULL THEN
        FOR feed_item IN SELECT * FROM jsonb_array_elements(p_feeds) LOOP
            INSERT INTO calendar_feeds (property_id, name, url) 
            VALUES (new_prop_id, feed_item->>'name', feed_item->>'url');
        END LOOP;
    END IF;

    -- Initial Inventory
    IF p_inventory IS NOT NULL THEN
        FOR inv_item IN SELECT * FROM jsonb_array_elements(p_inventory) LOOP
            INSERT INTO property_inventory (property_id, item_name, quantity, category) 
            VALUES (new_prop_id, inv_item->>'name', (inv_item->>'qty')::INT, inv_item->>'category');
        END LOOP;
    END IF;

    -- Attachments (if any)
    -- Logic for attachments can be added here if needed, currently just passed in but not used in this snippet
END;
$function$;
