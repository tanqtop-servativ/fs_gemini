-- Migration: BOM Templates Domain RPCs
-- Purpose: Create RPCs for BOM template operations
-- Date: 2024-12-10

-- ===========================================
-- 1. LIST BOM TEMPLATES RPC
-- ===========================================

CREATE OR REPLACE FUNCTION public.list_bom_templates(
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
                'id', bt.id,
                'tenant_id', bt.tenant_id,
                'name', bt.name,
                'description', bt.description,
                'created_at', bt.created_at,
                'deleted_at', bt.deleted_at
            ) ORDER BY bt.name
        ), '[]'::jsonb)
        FROM bom_templates bt
        WHERE bt.tenant_id = p_tenant_id
        AND (p_include_archived = true OR bt.deleted_at IS NULL)
    );
END;
$$;

-- ===========================================
-- 2. GET BOM TEMPLATE DETAIL RPC
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_bom_template_detail(
    p_template_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'id', bt.id,
            'tenant_id', bt.tenant_id,
            'name', bt.name,
            'description', bt.description,
            'created_at', bt.created_at,
            'deleted_at', bt.deleted_at,
            'items', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', bti.id,
                        'name', bti.name,
                        'quantity', bti.quantity,
                        'unit', bti.unit,
                        'price', bti.price,
                        'sort_order', bti.sort_order
                    ) ORDER BY bti.sort_order
                )
                FROM bom_template_items bti
                WHERE bti.bom_template_id = bt.id
            ), '[]'::jsonb)
        )
        FROM bom_templates bt
        WHERE bt.id = p_template_id
    );
END;
$$;

-- ===========================================
-- 3. ARCHIVE BOM TEMPLATE RPC
-- ===========================================

CREATE OR REPLACE FUNCTION public.archive_bom_template(
    p_template_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE bom_templates
    SET deleted_at = NOW()
    WHERE id = p_template_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION list_bom_templates(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_bom_template_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_bom_template(uuid) TO authenticated;
