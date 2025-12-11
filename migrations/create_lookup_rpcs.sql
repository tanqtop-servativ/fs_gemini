-- Migration: Lookup RPCs
-- Purpose: Lightweight RPCs for dropdown/lookup data
-- Date: 2024-12-10

-- ===========================================
-- 1. LOOKUP PEOPLE RPC
-- ===========================================
-- Returns minimal person data for dropdowns

CREATE OR REPLACE FUNCTION public.lookup_people(
    p_tenant_id uuid
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
                'first_name', p.first_name,
                'last_name', p.last_name,
                'roles', COALESCE((
                    SELECT string_agg(r.name, ', ' ORDER BY r.name)
                    FROM person_roles pr
                    JOIN roles r ON pr.role_id = r.id
                    WHERE pr.person_id = p.id
                ), '')
            ) ORDER BY p.last_name, p.first_name
        ), '[]'::jsonb)
        FROM people p
        WHERE p.tenant_id = p_tenant_id
        AND p.deleted_at IS NULL
    );
END;
$$;

-- ===========================================
-- 2. LOOKUP BOM TEMPLATES RPC
-- ===========================================
-- Returns minimal BOM template data for dropdowns

CREATE OR REPLACE FUNCTION public.lookup_bom_templates(
    p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', bt.id,
                'name', bt.name
            ) ORDER BY bt.name
        ), '[]'::jsonb)
        FROM bom_templates bt
        WHERE bt.tenant_id = p_tenant_id
        AND bt.deleted_at IS NULL
    );
END;
$$;

-- ===========================================
-- 3. GET BOM TEMPLATE ITEMS RPC
-- ===========================================
-- Returns items for a specific BOM template (for applying to inventory)

CREATE OR REPLACE FUNCTION public.get_bom_template_items(
    p_template_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', bti.id,
                'item_name', bti.item_name,
                'quantity', bti.quantity,
                'unit', bti.unit,
                'price', bti.price,
                'category', bti.category,
                'notes', bti.notes
            ) ORDER BY bti.sort_order
        ), '[]'::jsonb)
        FROM bom_template_items bti
        WHERE bti.bom_template_id = p_template_id
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION lookup_people(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION lookup_bom_templates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_bom_template_items(uuid) TO authenticated;
