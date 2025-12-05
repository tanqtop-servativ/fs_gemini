DROP VIEW IF EXISTS public.audit_history_view;
CREATE OR REPLACE VIEW public.audit_history_view AS
 SELECT al.id,
    al.table_name,
    al.record_id,
    al.operation,
    al.changed_at,
    al.changed_by,
    au.email AS changed_by_email,
    p.first_name AS changed_by_first_name,
    p.last_name AS changed_by_last_name,
    al.old_values,
    al.new_values,
        CASE
            WHEN al.operation = 'INSERT'::text THEN 'Created record'::text
            WHEN al.operation = 'DELETE'::text THEN 'Deleted record'::text
            WHEN al.operation = 'UPDATE'::text THEN 'Updated fields: '::text || (( SELECT string_agg(jsonb_each.key, ', '::text) AS string_agg
               FROM jsonb_each(al.new_values) jsonb_each(key, value)
              WHERE (al.new_values -> jsonb_each.key) IS DISTINCT FROM (al.old_values -> jsonb_each.key)))
            ELSE al.operation
        END AS description
   FROM audit_logs al
     LEFT JOIN auth.users au ON al.changed_by = au.id
     LEFT JOIN profiles p ON al.changed_by = p.id;
