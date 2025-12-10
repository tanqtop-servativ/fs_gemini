-- Tenant-Scoped Audit Triggers
-- Adds resolved_tenant_id to audit_logs and creates a smarter trigger function
-- that looks up the parent's tenant_id for child tables

-- 1. Add resolved_tenant_id column to audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resolved_tenant_id uuid;

-- 2. Create index on resolved_tenant_id for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_resolved_tenant_id ON audit_logs(resolved_tenant_id);

-- 3. Create the enhanced audit log function
CREATE OR REPLACE FUNCTION record_audit_log_with_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_data jsonb;
    v_new_data jsonb;
    v_user_id uuid;
    v_tenant_id uuid := null;
    v_row_data record;
BEGIN
    -- Try to get user ID from Supabase Auth
    v_user_id := auth.uid();
    
    IF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := null;
        v_row_data := OLD;
    ELSIF (TG_OP = 'INSERT') THEN
        v_old_data := null;
        v_new_data := to_jsonb(NEW);
        v_row_data := NEW;
    ELSE
        -- UPDATE: Check if data actually changed
        IF OLD IS NOT DISTINCT FROM NEW THEN
            RETURN NEW;
        END IF;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_row_data := NEW;
    END IF;

    -- Resolve tenant_id from the row or parent table
    -- First, try direct tenant_id on the row
    v_tenant_id := (to_jsonb(v_row_data)->>'tenant_id')::uuid;
    
    -- If no tenant_id, try resolving via parent relationships
    IF v_tenant_id IS NULL THEN
        -- Property-related tables: look up via property_id
        IF (to_jsonb(v_row_data)->>'property_id') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant_id 
            FROM properties 
            WHERE id = (to_jsonb(v_row_data)->>'property_id')::uuid;
        -- Job-related tables: look up via job_id
        ELSIF (to_jsonb(v_row_data)->>'job_id') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant_id 
            FROM jobs 
            WHERE id = (to_jsonb(v_row_data)->>'job_id')::uuid;
        -- Visit-related tables: look up via visit_id -> job_id
        ELSIF (to_jsonb(v_row_data)->>'visit_id') IS NOT NULL THEN
            SELECT j.tenant_id INTO v_tenant_id 
            FROM visits v
            JOIN jobs j ON j.id = v.job_id
            WHERE v.id = (to_jsonb(v_row_data)->>'visit_id')::uuid;
        -- Service opportunity tables: look up via service_opportunity_id
        ELSIF (to_jsonb(v_row_data)->>'service_opportunity_id') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant_id 
            FROM service_opportunities 
            WHERE id = (to_jsonb(v_row_data)->>'service_opportunity_id')::uuid;
        -- Job template tables: look up via job_template_id
        ELSIF (to_jsonb(v_row_data)->>'job_template_id') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant_id 
            FROM job_templates 
            WHERE id = (to_jsonb(v_row_data)->>'job_template_id')::uuid;
        -- BOM template tables: look up via bom_template_id
        ELSIF (to_jsonb(v_row_data)->>'bom_template_id') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant_id 
            FROM bom_templates 
            WHERE id = (to_jsonb(v_row_data)->>'bom_template_id')::uuid;
        -- Person-related tables: look up via person_id
        ELSIF (to_jsonb(v_row_data)->>'person_id') IS NOT NULL THEN
            SELECT tenant_id INTO v_tenant_id 
            FROM people 
            WHERE id = (to_jsonb(v_row_data)->>'person_id')::uuid;
        END IF;
    END IF;

    INSERT INTO audit_logs (table_name, record_id, operation, changed_by, old_values, new_values, resolved_tenant_id)
    VALUES (
        TG_TABLE_NAME,
        COALESCE((to_jsonb(v_row_data)->>'id')::uuid, null),
        TG_OP,
        v_user_id,
        v_old_data,
        v_new_data,
        v_tenant_id
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Replace triggers on child tables to use the new function
-- Property-related tables
DROP TRIGGER IF EXISTS audit_trigger ON property_access_codes;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_access_codes
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON property_attachments;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_attachments
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON property_instructions;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_instructions
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON property_inventory;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_inventory
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON property_reference_photos;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_reference_photos
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON calendar_feeds;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON calendar_feeds
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON property_assignments;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_assignments
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

-- Job-related tables
DROP TRIGGER IF EXISTS audit_trigger ON job_assignments;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_assignments
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON job_checklist_items;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_checklist_items
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON job_comments;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_comments
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON job_inputs;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_inputs
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON job_queue;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_queue
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON job_tasks;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_tasks
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON job_timers;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_timers
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

-- Job template tables
DROP TRIGGER IF EXISTS audit_trigger ON job_template_checklist_items;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_template_checklist_items
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON job_template_inputs;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_template_inputs
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

DROP TRIGGER IF EXISTS audit_trigger ON job_template_roles;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_template_roles
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

-- Visit tables
DROP TRIGGER IF EXISTS audit_trigger ON visits;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON visits
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

-- BOM template items
DROP TRIGGER IF EXISTS audit_trigger ON bom_template_items;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bom_template_items
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

-- Person-related tables
DROP TRIGGER IF EXISTS audit_trigger ON person_roles;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON person_roles
FOR EACH ROW EXECUTE FUNCTION record_audit_log_with_tenant();

-- 5. Update tenant_activity_feed view to use resolved_tenant_id
CREATE OR REPLACE VIEW tenant_activity_feed AS
SELECT 
    a.id::text AS event_id,
    a.changed_at AS timestamp,
    -- Use resolved_tenant_id if available, fallback to extracting from JSON
    COALESCE(
        a.resolved_tenant_id,
        (a.new_values->>'tenant_id')::uuid, 
        (a.old_values->>'tenant_id')::uuid
    ) AS tenant_id,
    'DATA_CHANGE'::text AS category,
    CASE 
        WHEN a.operation = 'DELETE' THEN 'WARNING'
        ELSE 'INFO'
    END AS severity,
    a.table_name || ' ' || a.operation || ': ' || COALESCE(a.record_id::text, '') AS summary,
    a.changed_by AS actor_id,
    u.email AS actor_email,
    jsonb_build_object(
        'table', a.table_name, 
        'operation', a.operation, 
        'record_id', a.record_id, 
        'old', a.old_values, 
        'new', a.new_values
    ) AS details
FROM audit_logs a
LEFT JOIN auth.users u ON a.changed_by = u.id
UNION ALL
SELECT 
    c.id::text AS event_id,
    c.created_at AS timestamp,
    c.tenant_id,
    'COMMUNICATION'::text AS category,
    'INFO'::text AS severity,
    c.type || ' to ' || c.recipient AS summary,
    c.created_by AS actor_id,
    u.email AS actor_email,
    jsonb_build_object(
        'type', c.type, 
        'recipient', c.recipient, 
        'direction', c.direction, 
        'content', c.content
    ) AS details
FROM communications c
LEFT JOIN auth.users u ON c.created_by = u.id;
