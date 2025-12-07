-- Enable audit logging for service_opportunities
DROP TRIGGER IF EXISTS audit_trigger ON public.service_opportunities;

CREATE TRIGGER audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.service_opportunities
FOR EACH ROW EXECUTE FUNCTION record_audit_log();
