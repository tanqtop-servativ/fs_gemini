-- Migration: Special Service Job Type
-- Purpose: Structured ad-hoc work with category taxonomy and billing
-- Date: 2024-12-08

-- ============================================================================
-- CATEGORIES REFERENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS special_service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    requires_photos BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(category, subcategory)
);

-- Seed categories
INSERT INTO special_service_categories (category, subcategory, requires_photos) VALUES
    -- Guest Service
    ('Guest Service', 'Welcome setup', false),
    ('Guest Service', 'Early check-in', false),
    ('Guest Service', 'Late checkout', false),
    ('Guest Service', 'Concierge request', false),
    ('Guest Service', 'Other', false),
    
    -- Owner Request
    ('Owner Request', 'Seasonal prep', false),
    ('Owner Request', 'Winterization', true),
    ('Owner Request', 'Owner visit prep', false),
    ('Owner Request', 'Storage', false),
    ('Owner Request', 'Other', false),
    
    -- Minor Repair
    ('Minor Repair', 'Plumbing', true),
    ('Minor Repair', 'Electrical', true),
    ('Minor Repair', 'HVAC', true),
    ('Minor Repair', 'Appliance', true),
    ('Minor Repair', 'Fixture', true),
    ('Minor Repair', 'Other', true),
    
    -- Emergency Response
    ('Emergency Response', 'Water damage', true),
    ('Emergency Response', 'Lock change', true),
    ('Emergency Response', 'Glass repair', true),
    ('Emergency Response', 'Pest', true),
    ('Emergency Response', 'Other', true),
    
    -- Maintenance
    ('Maintenance', 'Filter change', false),
    ('Maintenance', 'Battery replacement', false),
    ('Maintenance', 'Light bulb', false),
    ('Maintenance', 'Touch-up paint', true),
    ('Maintenance', 'Other', false),
    
    -- Delivery
    ('Delivery', 'Package handling', false),
    ('Delivery', 'Supply drop', false),
    ('Delivery', 'Key exchange', false),
    ('Delivery', 'Other', false),
    
    -- Inspection
    ('Inspection', 'Pre-arrival', false),
    ('Inspection', 'Mid-stay', false),
    ('Inspection', 'Post-checkout', false),
    ('Inspection', 'Insurance', true),
    ('Inspection', 'Other', false)
ON CONFLICT (category, subcategory) DO NOTHING;

-- ============================================================================
-- CREATE SPECIAL SERVICE JOB FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION create_special_service_job(
    p_service_opportunity_id UUID,
    p_category TEXT,
    p_subcategory TEXT,
    p_description TEXT,
    p_billable BOOLEAN,
    p_billing_type TEXT DEFAULT NULL,
    p_billing_amount NUMERIC DEFAULT NULL,
    p_estimated_duration_minutes INT DEFAULT NULL,
    p_requestor TEXT DEFAULT NULL,
    p_assigned_person_ids UUID[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_job_id UUID;
    v_visit_id UUID;
    v_tenant_id UUID;
    v_property_id UUID;
    v_requires_photos BOOLEAN;
    v_valid_category BOOLEAN;
    v_person_id UUID;
BEGIN
    -- Get tenant and property from service opportunity
    SELECT tenant_id, property_id 
    INTO v_tenant_id, v_property_id
    FROM service_opportunities 
    WHERE id = p_service_opportunity_id;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Service opportunity not found: %', p_service_opportunity_id;
    END IF;
    
    -- Validate category/subcategory
    SELECT EXISTS (
        SELECT 1 FROM special_service_categories 
        WHERE category = p_category 
          AND subcategory = p_subcategory
          AND is_active = true
    ), requires_photos
    INTO v_valid_category, v_requires_photos
    FROM special_service_categories 
    WHERE category = p_category AND subcategory = p_subcategory;
    
    IF NOT v_valid_category THEN
        RAISE EXCEPTION 'Invalid category/subcategory: %/%', p_category, p_subcategory;
    END IF;
    
    -- Validate description length
    IF LENGTH(TRIM(p_description)) < 50 THEN
        RAISE EXCEPTION 'Description must be at least 50 characters (got %)', LENGTH(TRIM(p_description));
    END IF;
    
    -- Validate billing
    IF p_billable THEN
        IF p_billing_type IS NULL THEN
            RAISE EXCEPTION 'Billable jobs require billing_type';
        END IF;
        
        IF p_billing_type NOT IN ('fixed', 'hourly', 'materials', 'hourly_plus_materials') THEN
            RAISE EXCEPTION 'Invalid billing_type: %', p_billing_type;
        END IF;
        
        IF p_billing_type = 'fixed' AND (p_billing_amount IS NULL OR p_billing_amount <= 0) THEN
            RAISE EXCEPTION 'Fixed billing requires a positive amount';
        END IF;
    END IF;
    
    -- Create job
    INSERT INTO jobs (
        tenant_id,
        service_opportunity_id,
        property_id,
        type,
        title,
        status,
        metadata
    ) VALUES (
        v_tenant_id,
        p_service_opportunity_id,
        v_property_id,
        'Special Service',
        p_category || ': ' || LEFT(TRIM(p_description), 50),
        'Pending',
        jsonb_build_object(
            'category', p_category,
            'subcategory', p_subcategory,
            'description', p_description,
            'billable', p_billable,
            'billable_locked', true,
            'billing_type', p_billing_type,
            'billing_amount', p_billing_amount,
            'estimated_duration_minutes', p_estimated_duration_minutes,
            'requestor', p_requestor,
            'requires_photos', COALESCE(v_requires_photos, false)
        )
    )
    RETURNING id INTO v_job_id;
    
    -- Create first visit
    v_visit_id := create_visit(v_job_id, NULL);
    
    -- Assign workers if provided
    IF p_assigned_person_ids IS NOT NULL THEN
        FOREACH v_person_id IN ARRAY p_assigned_person_ids LOOP
            INSERT INTO job_assignments (job_id, person_id, status)
            VALUES (v_job_id, v_person_id, 'assigned')
            ON CONFLICT (job_id, person_id) DO NOTHING;
        END LOOP;
    END IF;
    
    -- Record amendment
    PERFORM record_service_amendment(
        p_service_opportunity_id,
        'job_added',
        v_job_id,
        'Special Service: ' || p_category || ' - ' || p_subcategory
    );
    
    RETURN jsonb_build_object(
        'job_id', v_job_id,
        'visit_id', v_visit_id,
        'requires_photos', COALESCE(v_requires_photos, false)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_special_service_job(UUID, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, INT, TEXT, UUID[]) TO authenticated;

-- ============================================================================
-- GET SPECIAL SERVICE CATEGORIES
-- ============================================================================

CREATE OR REPLACE FUNCTION get_special_service_categories()
RETURNS TABLE (
    category TEXT,
    subcategory TEXT,
    requires_photos BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ssc.category,
        ssc.subcategory,
        ssc.requires_photos
    FROM special_service_categories ssc
    WHERE ssc.is_active = true
    ORDER BY ssc.category, ssc.subcategory;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_special_service_categories() TO authenticated;

-- ============================================================================
-- VALIDATE SPECIAL SERVICE ARTIFACT
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_special_service_artifact()
RETURNS TRIGGER AS $$
DECLARE
    v_job_metadata JSONB;
    v_requires_photos BOOLEAN;
BEGIN
    -- Only validate SpecialServiceArtifact
    IF NEW.artifact_type != 'SpecialServiceArtifact' THEN
        RETURN NEW;
    END IF;
    
    -- Get job metadata
    SELECT metadata INTO v_job_metadata
    FROM jobs WHERE id = NEW.job_id;
    
    v_requires_photos := (v_job_metadata->>'requires_photos')::boolean;
    
    -- Validate required fields
    IF NEW.payload->>'outcome' IS NULL THEN
        RAISE EXCEPTION 'SpecialServiceArtifact requires outcome field';
    END IF;
    
    IF NEW.payload->>'outcome' NOT IN ('resolved', 'partial', 'deferred', 'referred', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid outcome: %', NEW.payload->>'outcome';
    END IF;
    
    IF NEW.payload->>'work_performed' IS NULL OR LENGTH(NEW.payload->>'work_performed') < 20 THEN
        RAISE EXCEPTION 'work_performed must be at least 20 characters';
    END IF;
    
    -- Validate photos if required
    IF v_requires_photos THEN
        IF NEW.payload->'photos' IS NULL OR jsonb_array_length(NEW.payload->'photos') = 0 THEN
            RAISE EXCEPTION 'Photos are required for this category';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_special_service ON artifacts;
CREATE TRIGGER validate_special_service
    BEFORE INSERT ON artifacts
    FOR EACH ROW
    WHEN (NEW.artifact_type = 'SpecialServiceArtifact')
    EXECUTE FUNCTION validate_special_service_artifact();
