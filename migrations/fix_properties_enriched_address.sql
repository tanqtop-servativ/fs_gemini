-- Fix Address Comma Accumulation Bug
-- The properties_enriched view was concatenating address + city + zip
-- This caused trailing commas when city/zip were empty
-- On each edit, the display_address was saved back as address, accumulating commas

DROP VIEW IF EXISTS properties_enriched;

CREATE VIEW properties_enriched AS
SELECT 
    p.id,
    p.tenant_id,
    p.name,
    p.hcp_customer_id,
    p.hcp_address_id,
    p.address AS display_address, -- Use raw address without concatenation
    p.check_in_time,
    p.check_out_time,
    p.time_zone,
    p.is_dst,
    p.bedrooms,
    p.bathrooms,
    p.max_guests,
    p.has_pool,
    p.has_bbq,
    p.allows_pets,
    p.parking_instructions,
    COALESCE(p.status, 'active') AS status,
    p.front_photo_url,
    p.wifi_network,
    p.wifi_password,
    p.has_casita,
    p.square_footage,
    p.bathroom_sinks,
    p.bath_mats,
    (SELECT string_agg(pe.first_name || ' ' || COALESCE(pe.last_name, ''), ', ')
     FROM property_assignments pa
     JOIN people pe ON pe.id = pa.person_id
     JOIN roles r ON r.id = pa.role_id
     WHERE pa.property_id = p.id AND r.name = 'Owner') AS owner_names,
    (SELECT array_agg(pe.id)
     FROM property_assignments pa
     JOIN people pe ON pe.id = pa.person_id
     JOIN roles r ON r.id = pa.role_id
     WHERE pa.property_id = p.id AND r.name = 'Owner') AS owner_ids,
    (SELECT string_agg(pe.first_name || ' ' || COALESCE(pe.last_name, ''), ', ')
     FROM property_assignments pa
     JOIN people pe ON pe.id = pa.person_id
     JOIN roles r ON r.id = pa.role_id
     WHERE pa.property_id = p.id AND r.name = 'Property Manager') AS manager_names,
    (SELECT array_agg(pe.id)
     FROM property_assignments pa
     JOIN people pe ON pe.id = pa.person_id
     JOIN roles r ON r.id = pa.role_id
     WHERE pa.property_id = p.id AND r.name = 'Property Manager') AS manager_ids
FROM properties p;
