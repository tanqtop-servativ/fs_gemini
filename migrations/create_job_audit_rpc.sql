CREATE OR REPLACE FUNCTION get_job_audit_history(p_job_id uuid)
RETURNS SETOF audit_history_view
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM audit_history_view
  WHERE (table_name = 'job_templates' AND record_id = p_job_id)
     OR (table_name = 'job_template_tasks' AND (
          (new_values->>'job_template_id')::uuid = p_job_id
          OR 
          (old_values->>'job_template_id')::uuid = p_job_id
        ))
  ORDER BY changed_at DESC;
$$;
