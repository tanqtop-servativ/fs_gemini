-- RPC to fetch property audit history including related tables
-- (property_access_codes, calendar_feeds, property_inventory, etc.)

CREATE OR REPLACE FUNCTION get_property_audit_history(p_property_id uuid)
RETURNS SETOF audit_history_view
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM audit_history_view
  WHERE 
    -- Direct property changes
    (table_name = 'properties' AND record_id = p_property_id)
    -- Access codes changes
    OR (table_name = 'property_access_codes' AND (
          (new_values->>'property_id')::uuid = p_property_id
          OR 
          (old_values->>'property_id')::uuid = p_property_id
        ))
    -- Calendar feeds changes
    OR (table_name = 'calendar_feeds' AND (
          (new_values->>'property_id')::uuid = p_property_id
          OR 
          (old_values->>'property_id')::uuid = p_property_id
        ))
    -- Inventory changes
    OR (table_name = 'property_inventory' AND (
          (new_values->>'property_id')::uuid = p_property_id
          OR 
          (old_values->>'property_id')::uuid = p_property_id
        ))
    -- Reference photos changes
    OR (table_name = 'property_reference_photos' AND (
          (new_values->>'property_id')::uuid = p_property_id
          OR 
          (old_values->>'property_id')::uuid = p_property_id
        ))
    -- Attachments changes
    OR (table_name = 'property_attachments' AND (
          (new_values->>'property_id')::uuid = p_property_id
          OR 
          (old_values->>'property_id')::uuid = p_property_id
        ))
  ORDER BY changed_at DESC;
$$;
