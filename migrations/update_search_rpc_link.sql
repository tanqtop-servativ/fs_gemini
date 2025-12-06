-- Drop first to allow return type change
DROP FUNCTION IF EXISTS search_global(text, uuid);

-- Update Search RPC to include link
CREATE OR REPLACE FUNCTION search_global(
    p_query_text text,
    p_tenant_id uuid
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
    WHERE tenant_id = p_tenant_id
      AND search_vector @@ websearch_to_tsquery('english', p_query_text)
    ORDER BY rank DESC
    LIMIT 20;
$$;
