-- Migration: Create List RPCS
-- Purpose: Replace direct table selects with secure RPCs for Jobs and Properties
-- Date: 2024-12-09

-- ===========================================
-- 1. LIST JOBS RPC
-- ===========================================
-- Returns jobs for the active tenant, with optional status filtering.
-- Replaces: supabase.from('jobs').select('*, properties(name), ...').eq('tenant_id', ...)

CREATE OR REPLACE FUNCTION public.list_jobs(
    p_tenant_id uuid,
    p_status_filter text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', j.id,
                'title', j.title,
                'status', j.status,
                'priority', j.priority,
                'property_id', j.property_id,
                'created_at', j.created_at,
                'tenant_id', j.tenant_id,
                
                -- Joined Property Name
                'properties', jsonb_build_object('name', p.name),
                
                -- Joined Service Opportunity Details
                'service_opportunities', CASE 
                    WHEN so.id IS NOT NULL THEN jsonb_build_object(
                        'title', so.title,
                        'due_date', so.due_date
                    )
                    ELSE NULL
                END
            ) ORDER BY j.created_at DESC
        ), '[]'::jsonb)
        FROM jobs j
        LEFT JOIN properties p ON j.property_id = p.id
        LEFT JOIN service_opportunities so ON j.service_opportunity_id = so.id
        WHERE j.tenant_id = p_tenant_id
        AND j.deleted_at IS NULL
        AND (p_status_filter IS NULL OR j.status = ANY(p_status_filter))
    );
END;
$$;


-- ===========================================
-- 2. LIST PROPERTIES RPC
-- ===========================================
-- Returns properties for the active tenant.
-- Replaces: supabase.from('properties').select('*').eq('tenant_id', ...)

CREATE OR REPLACE FUNCTION public.list_properties(
    p_tenant_id uuid,
    p_include_archived boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            to_jsonb(p.*)
        ) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb)
        FROM properties p
        WHERE p.tenant_id = p_tenant_id
        AND p.deleted_at IS NULL
        AND (
            p_include_archived = true 
            OR p.status = 'active' 
            OR p.status IS NULL -- Treat null status as active for legacy compatibility
        )
    );
END;
$$;
