-- P4: Person Lookup View and SaveProperty Split
-- Optimizations for cleaner code and smaller payloads

-- 1. Create person lookup view for efficient name lookups
-- This can be converted to a materialized view later if performance becomes an issue
CREATE OR REPLACE VIEW person_lookup AS
SELECT 
  id,
  tenant_id,
  TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) AS full_name
FROM people;

-- 2. Create save_property_core RPC for scalar fields only
-- This reduces payload size when only updating basic property info
CREATE OR REPLACE FUNCTION public.save_property_core(
  p_id uuid,
  p_tenant_id uuid,
  p_name text,
  p_street_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_checkin time DEFAULT '16:00:00',
  p_checkout time DEFAULT '10:00:00',
  p_time_zone text DEFAULT 'US/Mountain',
  p_is_dst boolean DEFAULT false,
  p_bedrooms integer DEFAULT NULL,
  p_bathrooms numeric DEFAULT NULL,
  p_max_guests integer DEFAULT NULL,
  p_has_pool boolean DEFAULT false,
  p_has_bbq boolean DEFAULT false,
  p_allows_pets boolean DEFAULT false,
  p_has_casita boolean DEFAULT false,
  p_parking_instructions text DEFAULT NULL,
  p_wifi_network text DEFAULT NULL,
  p_wifi_password text DEFAULT NULL,
  p_photo_url text DEFAULT NULL,
  p_hcp_cust text DEFAULT NULL,
  p_hcp_addr text DEFAULT NULL,
  p_square_footage integer DEFAULT NULL,
  p_bathroom_sinks integer DEFAULT NULL,
  p_bath_mats integer DEFAULT NULL,
  p_door_code text DEFAULT NULL,
  p_garage_code text DEFAULT NULL,
  p_gate_code text DEFAULT NULL,
  p_closet_code text DEFAULT NULL,
  p_casita_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_id uuid;
BEGIN
  IF p_id IS NOT NULL THEN
    -- Update existing property
    UPDATE properties SET
      name = p_name,
      street_address = p_street_address,
      city = p_city,
      state = p_state,
      zip = p_zip,
      check_in_time = p_checkin,
      check_out_time = p_checkout,
      time_zone = p_time_zone,
      is_dst = p_is_dst,
      bedrooms = p_bedrooms,
      bathrooms = p_bathrooms,
      max_guests = p_max_guests,
      has_pool = p_has_pool,
      has_bbq = p_has_bbq,
      allows_pets = p_allows_pets,
      has_casita = p_has_casita,
      parking_instructions = p_parking_instructions,
      wifi_network = p_wifi_network,
      wifi_password = p_wifi_password,
      front_photo_url = p_photo_url,
      hcp_customer_id = p_hcp_cust,
      hcp_address_id = p_hcp_addr,
      square_footage = p_square_footage,
      bathroom_sinks = p_bathroom_sinks,
      bath_mats = p_bath_mats,
      updated_at = NOW()
    WHERE id = p_id;
    
    -- Update access codes
    UPDATE property_access_codes SET code_value = p_door_code WHERE property_id = p_id AND code_type = 'door';
    UPDATE property_access_codes SET code_value = p_garage_code WHERE property_id = p_id AND code_type = 'garage';
    UPDATE property_access_codes SET code_value = p_gate_code WHERE property_id = p_id AND code_type = 'gate';
    UPDATE property_access_codes SET code_value = p_closet_code WHERE property_id = p_id AND code_type = 'closet';
    UPDATE property_access_codes SET code_value = p_casita_code WHERE property_id = p_id AND code_type = 'casita';
    
    result_id := p_id;
  ELSE
    -- Create new property
    INSERT INTO properties (
      tenant_id, name, street_address, city, state, zip,
      check_in_time, check_out_time, time_zone, is_dst,
      bedrooms, bathrooms, max_guests, has_pool, has_bbq, allows_pets, has_casita,
      parking_instructions, wifi_network, wifi_password, front_photo_url,
      hcp_customer_id, hcp_address_id, square_footage, bathroom_sinks, bath_mats
    ) VALUES (
      p_tenant_id, p_name, p_street_address, p_city, p_state, p_zip,
      p_checkin, p_checkout, p_time_zone, p_is_dst,
      p_bedrooms, p_bathrooms, p_max_guests, p_has_pool, p_has_bbq, p_allows_pets, p_has_casita,
      p_parking_instructions, p_wifi_network, p_wifi_password, p_photo_url,
      p_hcp_cust, p_hcp_addr, p_square_footage, p_bathroom_sinks, p_bath_mats
    )
    RETURNING id INTO result_id;
    
    -- Insert access codes for new property
    INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES
      (result_id, 'door', p_door_code),
      (result_id, 'garage', p_garage_code),
      (result_id, 'gate', p_gate_code),
      (result_id, 'closet', p_closet_code),
      (result_id, 'casita', p_casita_code);
  END IF;
  
  RETURN jsonb_build_object('success', true, 'property_id', result_id);
END;
$$;

-- 3. Create save_property_collections RPC for feeds/inventory
CREATE OR REPLACE FUNCTION public.save_property_collections(
  p_property_id uuid,
  p_feeds jsonb DEFAULT '[]'::jsonb,
  p_inventory jsonb DEFAULT '[]'::jsonb,
  p_owner_ids uuid[] DEFAULT '{}',
  p_manager_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  feed_item jsonb;
  inv_item jsonb;
  owner_id uuid;
  manager_id uuid;
  owner_role_id uuid;
  manager_role_id uuid;
BEGIN
  -- Get role IDs
  SELECT id INTO owner_role_id FROM roles WHERE name = 'Owner' LIMIT 1;
  SELECT id INTO manager_role_id FROM roles WHERE name = 'Property Manager' LIMIT 1;
  
  -- Update feeds: delete existing and insert new
  DELETE FROM calendar_feeds WHERE property_id = p_property_id;
  FOR feed_item IN SELECT * FROM jsonb_array_elements(p_feeds)
  LOOP
    INSERT INTO calendar_feeds (property_id, name, url)
    VALUES (p_property_id, feed_item->>'name', feed_item->>'url');
  END LOOP;
  
  -- Update inventory: delete existing and insert new
  DELETE FROM property_inventory WHERE property_id = p_property_id;
  FOR inv_item IN SELECT * FROM jsonb_array_elements(p_inventory)
  LOOP
    INSERT INTO property_inventory (property_id, item_name, quantity, category)
    VALUES (
      p_property_id, 
      inv_item->>'name', 
      COALESCE((inv_item->>'qty')::integer, 1),
      COALESCE(inv_item->>'category', 'General')
    );
  END LOOP;
  
  -- Update owner assignments
  DELETE FROM property_assignments WHERE property_id = p_property_id AND role_id = owner_role_id;
  FOREACH owner_id IN ARRAY p_owner_ids
  LOOP
    INSERT INTO property_assignments (property_id, person_id, role_id)
    VALUES (p_property_id, owner_id, owner_role_id);
  END LOOP;
  
  -- Update manager assignments
  DELETE FROM property_assignments WHERE property_id = p_property_id AND role_id = manager_role_id;
  FOREACH manager_id IN ARRAY p_manager_ids
  LOOP
    INSERT INTO property_assignments (property_id, person_id, role_id)
    VALUES (p_property_id, manager_id, manager_role_id);
  END LOOP;
  
  RETURN jsonb_build_object('success', true);
END;
$$;
