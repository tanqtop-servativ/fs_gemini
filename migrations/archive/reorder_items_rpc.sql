CREATE OR REPLACE FUNCTION public.reorder_items(
    p_table text,
    p_id_col text,
    p_order_col text,
    p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    item jsonb;
    query text;
BEGIN
    -- Validate table name to prevent SQL injection (allowlist)
    IF p_table NOT IN ('property_reference_photos', 'job_template_tasks', 'bom_template_items') THEN
        RAISE EXCEPTION 'Invalid table name for reordering';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        query := format('UPDATE %I SET %I = $1 WHERE %I = $2', p_table, p_order_col, p_id_col);
        EXECUTE query USING (item->>'order')::int, (item->>'id')::uuid;
    END LOOP;
END;
$function$;
