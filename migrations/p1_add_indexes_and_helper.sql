-- P1: Add indexes for assignment tables and helper function for owners/managers JSON
-- Run this migration after existing property RPC migrations

-- Indexes for faster joins
CREATE INDEX IF NOT EXISTS idx_property_assignments_property_id ON property_assignments(property_id);
CREATE INDEX IF NOT EXISTS idx_property_assignments_person_id ON property_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_property_assignments_role_id ON property_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_properties_tenant_id ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_time_zone ON properties(time_zone);

-- Helper function to generate owners or managers JSON array for a property
CREATE OR REPLACE FUNCTION json_property_people(p_property_id uuid, p_role_name text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', pe.id,
                'name', trim(coalesce(pe.first_name, '') || ' ' || coalesce(pe.last_name, ''))
            )
        ), '[]'::jsonb
    )
    FROM property_assignments pa
    JOIN people pe ON pe.id = pa.person_id
    JOIN roles r ON r.id = pa.role_id
    WHERE pa.property_id = p_property_id
      AND r.name = p_role_name;
$$;
