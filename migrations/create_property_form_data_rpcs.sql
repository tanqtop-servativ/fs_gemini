-- Migration: Property Form Data RPCs
-- Purpose: Create RPCs for fetching property-related data for PropertyFormModal
-- Date: 2024-12-10

-- ===========================================
-- 1. GET PROPERTY FORM DATA RPC
-- ===========================================
-- Returns all related data needed for the property form in a single call

CREATE OR REPLACE FUNCTION public.get_property_form_data(
    p_property_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN jsonb_build_object(
        'access_codes', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', pac.id,
                    'code_type', pac.code_type,
                    'code_value', pac.code_value,
                    'notes', pac.notes
                )
            )
            FROM property_access_codes pac
            WHERE pac.property_id = p_property_id
        ), '[]'::jsonb),
        
        'calendar_feeds', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', cf.id,
                    'platform', cf.platform,
                    'ical_url', cf.ical_url,
                    'is_active', cf.is_active
                )
            )
            FROM calendar_feeds cf
            WHERE cf.property_id = p_property_id
        ), '[]'::jsonb),
        
        'inventory', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', pi.id,
                    'name', pi.name,
                    'qty', pi.qty,
                    'category', pi.category
                )
            )
            FROM property_inventory pi
            WHERE pi.property_id = p_property_id
        ), '[]'::jsonb),
        
        'reference_photos', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', prp.id,
                    'url', prp.url,
                    'caption', prp.caption,
                    'sort_order', prp.sort_order
                ) ORDER BY prp.sort_order
            )
            FROM property_reference_photos prp
            WHERE prp.property_id = p_property_id
        ), '[]'::jsonb),
        
        'attachments', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', pa.id,
                    'file_name', pa.file_name,
                    'file_url', pa.file_url,
                    'file_type', pa.file_type,
                    'created_at', pa.created_at
                ) ORDER BY pa.created_at DESC
            )
            FROM property_attachments pa
            WHERE pa.property_id = p_property_id
        ), '[]'::jsonb)
    );
END;
$$;

-- ===========================================
-- 2. GET MASTER ITEM CATALOG RPC
-- ===========================================
-- Returns the master item catalog for inventory autocomplete

CREATE OR REPLACE FUNCTION public.get_master_item_catalog()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE((
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', mic.id,
                'name', mic.name,
                'category', mic.category,
                'default_qty', mic.default_qty
            ) ORDER BY mic.name
        )
        FROM master_item_catalog mic
    ), '[]'::jsonb);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_property_form_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_master_item_catalog() TO authenticated;
