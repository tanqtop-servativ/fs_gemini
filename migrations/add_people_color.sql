-- Add color column to people table
-- Stores hex color value like #FF5733 for visual identification

ALTER TABLE people ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- Add comment explaining the column
COMMENT ON COLUMN people.color IS 'Hex color value for visual identification (e.g., #FF5733)';

-- Update people_enriched view to include color column
DROP VIEW IF EXISTS people_enriched CASCADE;
CREATE VIEW people_enriched AS
SELECT 
    id,
    readable_id,
    tenant_id,
    user_id,
    first_name,
    last_name,
    email,
    phone,
    color,
    created_at,
    updated_at,
    deleted_at,
    (SELECT string_agg(r.name, ', ')
     FROM person_roles pr
     JOIN roles r ON r.id = pr.role_id
     WHERE pr.person_id = p.id) AS roles_display,
    ARRAY(SELECT pr.role_id
          FROM person_roles pr
          WHERE pr.person_id = p.id) AS role_ids
FROM people p;
