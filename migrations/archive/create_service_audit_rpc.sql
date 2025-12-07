
CREATE OR REPLACE FUNCTION get_service_audit_history(p_service_id uuid)
RETURNS SETOF audit_history_view
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM audit_history_view
  WHERE (table_name = 'service_templates' AND record_id = p_service_id)
     OR (table_name = 'service_workflow_steps' AND (
          (new_values->>'service_template_id')::uuid = p_service_id
          OR 
          (old_values->>'service_template_id')::uuid = p_service_id
        ))
  ORDER BY changed_at DESC;
$$;
