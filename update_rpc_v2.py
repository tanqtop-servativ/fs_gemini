import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_CONNECTION_STRING = os.getenv("DB_CONNECTION_STRING")

# SQL to replace CREATE function
create_sql = """
CREATE OR REPLACE FUNCTION public.create_property_safe(
    p_name text, 
    p_address text, 
    p_hcp_cust text, 
    p_hcp_addr text, 
    p_checkin time without time zone, 
    p_checkout time without time zone, 
    p_owner_ids integer[], 
    p_manager_ids integer[], 
    p_photo_url text, 
    p_door_code text, 
    p_garage_code text, 
    p_gate_code text, 
    p_closet_code text, 
    p_wifi_network text,
    p_wifi_password text,
    p_bedrooms integer,         -- NEW
    p_bathrooms numeric,        -- NEW
    p_max_guests integer,       -- NEW
    p_has_pool boolean,         -- NEW
    p_has_bbq boolean,          -- NEW
    p_allows_pets boolean,      -- NEW
    p_parking_instructions text,-- NEW
    p_feeds jsonb DEFAULT '[]'::jsonb, 
    p_inventory jsonb DEFAULT '[]'::jsonb
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  new_prop_id INT;
  feed_item JSONB;
  inv_item JSONB;
  pid INT;
BEGIN
    INSERT INTO properties (
        tenant_id, name, display_address, hcp_customer_id, hcp_address_id, 
        check_in_time, check_out_time, front_photo_url, 
        wifi_network, wifi_password,
        bedrooms, bathrooms, max_guests, has_pool, has_bbq, allows_pets, parking_instructions -- NEW
    )
    VALUES (
        1, p_name, p_address, p_hcp_cust, p_hcp_addr, 
        p_checkin, p_checkout, p_photo_url,
        p_wifi_network, p_wifi_password,
        p_bedrooms, p_bathrooms, p_max_guests, p_has_pool, p_has_bbq, p_allows_pets, p_parking_instructions -- NEW
    )
    RETURNING id INTO new_prop_id;

    -- Assignments
    IF p_owner_ids IS NOT NULL THEN
        FOREACH pid IN ARRAY p_owner_ids LOOP
            INSERT INTO property_assignments (property_id, person_id) VALUES (new_prop_id, pid);
        END LOOP;
    END IF;

    IF p_manager_ids IS NOT NULL THEN
        FOREACH pid IN ARRAY p_manager_ids LOOP
            IF NOT EXISTS (SELECT 1 FROM property_assignments WHERE property_id = new_prop_id AND person_id = pid) THEN
                INSERT INTO property_assignments (property_id, person_id) VALUES (new_prop_id, pid);
            END IF;
        END LOOP;
    END IF;

    -- Codes
    IF p_door_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Door', p_door_code); END IF;
    IF p_garage_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Garage', p_garage_code); END IF;
    IF p_gate_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Community Gate', p_gate_code); END IF;
    IF p_closet_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (new_prop_id, 'Owner Closet', p_closet_code); END IF;

    -- Feeds
    IF p_feeds IS NOT NULL THEN
        FOR feed_item IN SELECT * FROM jsonb_array_elements(p_feeds) LOOP
            INSERT INTO calendar_feeds (property_id, name, url) VALUES (new_prop_id, feed_item->>'name', feed_item->>'url');
        END LOOP;
    END IF;

    -- Inventory
    IF p_inventory IS NOT NULL THEN
        FOR inv_item IN SELECT * FROM jsonb_array_elements(p_inventory) LOOP
            INSERT INTO property_inventory (property_id, item_name, quantity, category) 
            VALUES (new_prop_id, inv_item->>'name', (inv_item->>'qty')::INT, inv_item->>'category');
        END LOOP;
    END IF;
END;
$function$;
"""

# SQL to replace UPDATE function
update_sql = """
CREATE OR REPLACE FUNCTION public.update_property_safe(
    p_id integer, 
    p_name text, 
    p_address text, 
    p_hcp_cust text, 
    p_hcp_addr text, 
    p_checkin time without time zone, 
    p_checkout time without time zone, 
    p_owner_ids integer[], 
    p_manager_ids integer[], 
    p_photo_url text, 
    p_door_code text, 
    p_garage_code text, 
    p_gate_code text, 
    p_closet_code text, 
    p_wifi_network text,
    p_wifi_password text,
    p_bedrooms integer,         -- NEW
    p_bathrooms numeric,        -- NEW
    p_max_guests integer,       -- NEW
    p_has_pool boolean,         -- NEW
    p_has_bbq boolean,          -- NEW
    p_allows_pets boolean,      -- NEW
    p_parking_instructions text,-- NEW
    p_feeds jsonb DEFAULT '[]'::jsonb, 
    p_inventory jsonb DEFAULT '[]'::jsonb
)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  feed_item JSONB;
  inv_item JSONB;
  pid INT;
BEGIN
    UPDATE properties 
    SET name = p_name, display_address = p_address, hcp_customer_id = p_hcp_cust, hcp_address_id = p_hcp_addr, 
        check_in_time = p_checkin, check_out_time = p_checkout, front_photo_url = p_photo_url,
        wifi_network = p_wifi_network, wifi_password = p_wifi_password,
        bedrooms = p_bedrooms, bathrooms = p_bathrooms, max_guests = p_max_guests,
        has_pool = p_has_pool, has_bbq = p_has_bbq, allows_pets = p_allows_pets,
        parking_instructions = p_parking_instructions -- NEW
    WHERE id = p_id;

    DELETE FROM property_assignments WHERE property_id = p_id;
    
    IF p_owner_ids IS NOT NULL THEN
        FOREACH pid IN ARRAY p_owner_ids LOOP
            INSERT INTO property_assignments (property_id, person_id) VALUES (p_id, pid);
        END LOOP;
    END IF;

    IF p_manager_ids IS NOT NULL THEN
        FOREACH pid IN ARRAY p_manager_ids LOOP
            IF NOT EXISTS (SELECT 1 FROM property_assignments WHERE property_id = p_id AND person_id = pid) THEN
                INSERT INTO property_assignments (property_id, person_id) VALUES (p_id, pid);
            END IF;
        END LOOP;
    END IF;

    -- Codes
    DELETE FROM property_access_codes WHERE property_id = p_id AND code_type IN ('Door', 'Garage', 'Community Gate', 'Owner Closet');
    IF p_door_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Door', p_door_code); END IF;
    IF p_garage_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Garage', p_garage_code); END IF;
    IF p_gate_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Community Gate', p_gate_code); END IF;
    IF p_closet_code != '' THEN INSERT INTO property_access_codes (property_id, code_type, code_value) VALUES (p_id, 'Owner Closet', p_closet_code); END IF;

    -- Feeds
    DELETE FROM calendar_feeds WHERE property_id = p_id;
    IF p_feeds IS NOT NULL THEN
        FOR feed_item IN SELECT * FROM jsonb_array_elements(p_feeds) LOOP
            INSERT INTO calendar_feeds (property_id, name, url) VALUES (p_id, feed_item->>'name', feed_item->>'url');
        END LOOP;
    END IF;

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
"""

try:
    conn = psycopg2.connect(DB_CONNECTION_STRING)
    cur = conn.cursor()
    
    print("Updating create_property_safe...")
    cur.execute(create_sql)
    
    print("Updating update_property_safe...")
    cur.execute(update_sql)
    
    conn.commit()
    print("✅ RPC functions updated successfully.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    if 'conn' in locals() and conn:
        conn.rollback()
finally:
    if 'conn' in locals() and conn:
        conn.close()
