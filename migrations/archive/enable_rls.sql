-- Helper function to get current user's tenant_id securely
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT tenant_id FROM people WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Enable RLS on key tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_templates ENABLE ROW LEVEL SECURITY;

-- Create Policies using the helper
-- Properties
DROP POLICY IF EXISTS tenant_isolation ON properties;
CREATE POLICY tenant_isolation ON properties
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());

-- People
DROP POLICY IF EXISTS tenant_isolation ON people;
CREATE POLICY tenant_isolation ON people
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
-- Allow users to see themselves even if get_my_tenant_id fails (bootstrapping)
CREATE POLICY self_access ON people
    USING (user_id = auth.uid());

-- Jobs
DROP POLICY IF EXISTS tenant_isolation ON jobs;
CREATE POLICY tenant_isolation ON jobs
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());

-- Service Opportunities
DROP POLICY IF EXISTS tenant_isolation ON service_opportunities;
CREATE POLICY tenant_isolation ON service_opportunities
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());

-- Service Templates
DROP POLICY IF EXISTS tenant_isolation ON service_templates;
CREATE POLICY tenant_isolation ON service_templates
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());

-- BOM Templates
DROP POLICY IF EXISTS tenant_isolation ON bom_templates;
CREATE POLICY tenant_isolation ON bom_templates
    USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());

-- Update Global Search RPC to enforce tenant check
-- We'll modify it to ignore the passed p_tenant_id and use the secure one, 
-- OR validate it. Let's start by trusting the RLS by removing SECURITY DEFINER?
-- No, the View `global_search_view` might not transparently pass RLS triggers if complex.
-- Safest is to keep SECURITY DEFINER but enforce the check inside query.

CREATE OR REPLACE FUNCTION search_global(
    p_query_text text,
    p_tenant_id uuid -- We keep signature but ignore it or validate it
)
RETURNS TABLE (
    id text,
    type text,
    title text,
    subtitle text,
    link text,
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
        link,
        ts_rank(search_vector, websearch_to_tsquery('english', p_query_text)) as rank
    FROM global_search_view
    WHERE tenant_id = get_my_tenant_id() -- Enforce secure tenant ID
      AND search_vector @@ websearch_to_tsquery('english', p_query_text)
    ORDER BY rank DESC
    LIMIT 20;
$$;
