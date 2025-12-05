
-- Add audit trigger to service_workflow_steps
DROP TRIGGER IF EXISTS audit_trigger ON service_workflow_steps;

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON service_workflow_steps
    FOR EACH ROW EXECUTE FUNCTION record_audit_log();
