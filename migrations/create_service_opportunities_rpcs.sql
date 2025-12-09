-- Service Opportunities Domain RPCs
-- Centralizes service opportunity business logic in the database

-- ============================================
-- 1. GET SERVICE OPPORTUNITY DETAIL
-- Returns full opportunity with jobs and workflow status
-- ============================================
CREATE OR REPLACE FUNCTION public.get_service_opportunity_detail(p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    opp_record record;
BEGIN
    -- Get opportunity with property and template
    SELECT 
        so.id,
        so.title,
        so.status,
        so.due_date,
        so.trigger_source,
        so.dismissal_reason,
        so.created_at,
        p.id as property_id,
        p.name as property_name,
        p.address as property_address,
        st.id as template_id,
        st.name as template_name
    INTO opp_record
    FROM service_opportunities so
    LEFT JOIN properties p ON p.id = so.property_id
    LEFT JOIN service_templates st ON st.id = so.service_template_id
    WHERE so.id = p_opportunity_id AND so.deleted_at IS NULL;
    
    IF opp_record IS NULL THEN
        RETURN jsonb_build_object('error', 'Service opportunity not found');
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'id', opp_record.id,
        'title', opp_record.title,
        'status', opp_record.status,
        'due_date', opp_record.due_date,
        'trigger_source', opp_record.trigger_source,
        'dismissal_reason', opp_record.dismissal_reason,
        'created_at', opp_record.created_at,
        'property', jsonb_build_object(
            'id', opp_record.property_id,
            'name', opp_record.property_name,
            'address', opp_record.property_address
        ),
        'template', CASE 
            WHEN opp_record.template_id IS NOT NULL THEN 
                jsonb_build_object(
                    'id', opp_record.template_id,
                    'name', opp_record.template_name
                )
            ELSE NULL
        END,
        'jobs', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', j.id,
                    'title', j.title,
                    'status', j.status,
                    'readable_id', j.readable_id,
                    'created_at', j.created_at
                ) ORDER BY j.created_at
            ), '[]'::jsonb)
            FROM jobs j 
            WHERE j.service_opportunity_id = p_opportunity_id 
            AND j.deleted_at IS NULL
        )
    );
    
    RETURN result;
END;
$$;

-- ============================================
-- 2. CREATE SERVICE OPPORTUNITY
-- ============================================
CREATE OR REPLACE FUNCTION public.create_service_opportunity(
    p_tenant_id uuid,
    p_property_id uuid,
    p_title text,
    p_service_template_id uuid DEFAULT NULL,
    p_trigger_source text DEFAULT 'Manual',
    p_due_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id uuid;
BEGIN
    INSERT INTO service_opportunities (
        tenant_id, property_id, title, service_template_id, 
        trigger_source, due_date, status
    )
    VALUES (
        p_tenant_id, p_property_id, p_title, p_service_template_id,
        p_trigger_source, p_due_date, 'Open'
    )
    RETURNING id INTO new_id;
    
    RETURN jsonb_build_object('success', true, 'opportunity_id', new_id);
END;
$$;

-- ============================================
-- 3. UPDATE SERVICE OPPORTUNITY
-- ============================================
CREATE OR REPLACE FUNCTION public.update_service_opportunity(
    p_opportunity_id uuid,
    p_property_id uuid DEFAULT NULL,
    p_service_template_id uuid DEFAULT NULL,
    p_trigger_source text DEFAULT NULL,
    p_due_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE service_opportunities
    SET 
        property_id = COALESCE(p_property_id, property_id),
        service_template_id = COALESCE(p_service_template_id, service_template_id),
        trigger_source = COALESCE(p_trigger_source, trigger_source),
        due_date = COALESCE(p_due_date, due_date)
    WHERE id = p_opportunity_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 4. DISMISS SERVICE OPPORTUNITY
-- ============================================
CREATE OR REPLACE FUNCTION public.dismiss_service_opportunity(
    p_opportunity_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TRIM(p_reason) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Dismissal reason is required');
    END IF;
    
    UPDATE service_opportunities
    SET status = 'Dismissed', dismissal_reason = p_reason
    WHERE id = p_opportunity_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 5. COMPLETE SERVICE OPPORTUNITY
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_service_opportunity(p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE service_opportunities
    SET status = 'Complete'
    WHERE id = p_opportunity_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 6. DELETE SERVICE OPPORTUNITY (soft)
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_service_opportunity(p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE service_opportunities
    SET deleted_at = NOW()
    WHERE id = p_opportunity_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;
