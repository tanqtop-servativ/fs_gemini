-- Add deleted_at to service_templates if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'service_templates' AND column_name = 'deleted_at') THEN
        ALTER TABLE service_templates ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Drop existing search objects
DROP FUNCTION IF EXISTS search_global(text, uuid);
DROP VIEW IF EXISTS global_search_view;

-- Create Global Search View
CREATE VIEW global_search_view AS
-- Properties
SELECT
    id::text as id,
    tenant_id,
    'property' as type,
    name as title,
    address as subtitle,
    '/properties' as link,
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(address, '')), 'B') as search_vector
FROM properties
WHERE deleted_at IS NULL

UNION ALL

-- People
SELECT
    id::text as id,
    tenant_id,
    'person' as type,
    first_name || ' ' || last_name as title,
    email as subtitle,
    '/people' as link,
    setweight(to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'B') as search_vector
FROM people
WHERE deleted_at IS NULL

UNION ALL

-- Jobs
SELECT
    id::text as id,
    tenant_id,
    'job' as type,
    title,
    coalesce(readable_id, '') || ' ' || status as subtitle,
    NULL as link,
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(readable_id, '')), 'A') as search_vector
FROM jobs
WHERE deleted_at IS NULL

UNION ALL

-- Service Opportunities
SELECT
    id::text as id,
    tenant_id,
    'service_opportunity' as type,
    title,
    status as subtitle,
    NULL as link,
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') as search_vector
FROM service_opportunities
WHERE deleted_at IS NULL

UNION ALL

-- Service Templates
SELECT
    id::text as id,
    tenant_id,
    'service_template' as type,
    name as title,
    description as subtitle,
    '/settings/templates' as link,
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') as search_vector
FROM service_templates
WHERE deleted_at IS NULL;

-- Create Search RPC
CREATE OR REPLACE FUNCTION search_global(
    p_query_text text,
    p_tenant_id uuid
)
RETURNS TABLE (
    id text,
    type text,
    title text,
    subtitle text,
    rank real
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        id,
        type,
        title,
        subtitle,
        ts_rank(search_vector, websearch_to_tsquery('english', p_query_text)) as rank
    FROM global_search_view
    WHERE tenant_id = p_tenant_id
      AND search_vector @@ websearch_to_tsquery('english', p_query_text)
    ORDER BY rank DESC
    LIMIT 20;
$$;
