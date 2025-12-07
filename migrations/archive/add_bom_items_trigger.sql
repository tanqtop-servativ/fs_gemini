CREATE TRIGGER audit_trigger
AFTER INSERT OR DELETE OR UPDATE ON public.bom_template_items
FOR EACH ROW EXECUTE FUNCTION record_audit_log();
