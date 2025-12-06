-- Update Global Search View with correct links for all entities
CREATE OR REPLACE VIEW global_search_view AS
-- Properties
SELECT
    id::text as id,
    tenant_id,
    'property' as type,
    name as title,
    address as subtitle,
    '/properties?id=' || id::text as link,
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(address, '')), 'B') as search_vector
FROM properties
WHERE deleted_at IS NULL 
  AND (status IS NULL OR status != 'archived')

UNION ALL

-- People
SELECT
    id::text as id,
    tenant_id,
    'person' as type,
    first_name || ' ' || last_name as title,
    email as subtitle,
    '/people?id=' || id::text as link,
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
    '/jobs/' || id::text as link,
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(readable_id, '')), 'A') as search_vector
FROM jobs
WHERE deleted_at IS NULL
  AND (status IS NULL OR status != 'archived')

UNION ALL

-- Service Opportunities
SELECT
    id::text as id,
    tenant_id,
    'service_opportunity' as type,
    title,
    status as subtitle,
    '/service-opportunities?id=' || id::text as link,
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') as search_vector
FROM service_opportunities
WHERE deleted_at IS NULL
  AND (status IS NULL OR status != 'archived')

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
