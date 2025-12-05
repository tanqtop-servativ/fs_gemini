CREATE TRIGGER audit_trigger
AFTER INSERT OR DELETE OR UPDATE ON public.job_template_tasks
FOR EACH ROW EXECUTE FUNCTION record_audit_log();
