CREATE OR REPLACE FUNCTION get_bom_audit_history(p_bom_id uuid)
RETURNS SETOF audit_history_view
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM audit_history_view
  WHERE (table_name = 'bom_templates' AND record_id = p_bom_id)
     OR (table_name = 'bom_template_items' AND (
          (new_values->>'bom_template_id')::uuid = p_bom_id
          OR 
          (old_values->>'bom_template_id')::uuid = p_bom_id
        ))
  ORDER BY changed_at DESC;
$$;
