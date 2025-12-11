-- Migration: People Domain RPCs
-- Purpose: Create RPCs for listing people and roles to support composable-based architecture
-- Date: 2024-12-10

-- ===========================================
-- 1. LIST PEOPLE RPC
-- ===========================================
-- Returns people for the active tenant with enriched data (roles, etc.)

CREATE OR REPLACE FUNCTION public.list_people(
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
            jsonb_build_object(
                'id', p.id,
                'tenant_id', p.tenant_id,
                'first_name', p.first_name,
                'last_name', p.last_name,
                'email', p.email,
                'phone', p.phone,
                'color', p.color,
                'user_id', p.user_id,
                'created_at', p.created_at,
                'deleted_at', p.deleted_at,
                -- Enriched role data
                'role_ids', COALESCE((
                    SELECT jsonb_agg(pr.role_id)
                    FROM person_roles pr
                    WHERE pr.person_id = p.id
                ), '[]'::jsonb),
                'roles_display', COALESCE((
                    SELECT string_agg(r.name, ', ' ORDER BY r.name)
                    FROM person_roles pr
                    JOIN roles r ON pr.role_id = r.id
                    WHERE pr.person_id = p.id
                ), '')
            ) ORDER BY p.last_name, p.first_name
        ), '[]'::jsonb)
        FROM people p
        WHERE p.tenant_id = p_tenant_id
        AND (p_include_archived = true OR p.deleted_at IS NULL)
    );
END;
$$;

-- ===========================================
-- 2. LIST ROLES RPC
-- ===========================================
-- Returns all roles (global, not tenant-specific currently)

CREATE OR REPLACE FUNCTION public.list_roles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'name', r.name,
                'description', r.description,
                'created_at', r.created_at
            ) ORDER BY r.name
        ), '[]'::jsonb)
        FROM roles r
    );
END;
$$;
