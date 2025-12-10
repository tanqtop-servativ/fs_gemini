-- Add audit log triggers to all tables that don't have them
-- This ensures all data changes are tracked for compliance and debugging

-- Tables to add audit triggers to (excluding audit_logs itself, deprecated tables, and immutable tables)
-- Note: Some tables have intentional immutability triggers instead (artifacts, bom_snapshots, job_dispositions, service_amendments, worker_visit_logs)

-- Calendar and Property-related tables
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON calendar_feeds
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_access_codes
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_attachments
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_instructions
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_inventory
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON property_reference_photos
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- Job-related tables
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_assignments
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_checklist_items
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_comments
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_inputs
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_queue
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_tasks
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_timers
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- Job template-related tables
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_template_checklist_items
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_template_inputs
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON job_template_roles
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- Booking and calendar tables
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON booking_history
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- Service-related tables
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON service_jobs
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- Admin/Config tables
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON master_item_catalog
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON standard_line_items
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON special_service_categories
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON task_library
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON task_templates
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- Communication tables
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON communications
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- HCP integration
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON hcp_jobs
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- Visits (already has terminal check trigger, but adding audit too)
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON visits
FOR EACH ROW EXECUTE FUNCTION record_audit_log();

-- Tables intentionally NOT given audit triggers:
-- - audit_logs: This IS the audit log table
-- - artifacts: Has immutability trigger
-- - bom_snapshots: Has immutability trigger  
-- - job_dispositions: Has immutability trigger
-- - service_amendments: Has immutability trigger
-- - worker_visit_logs: Has immutability trigger
-- - service_workflow_steps_deprecated_v2: Deprecated table
