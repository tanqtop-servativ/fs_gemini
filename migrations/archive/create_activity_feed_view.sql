-- Drop view if exists
DROP VIEW IF EXISTS tenant_activity_feed;

CREATE VIEW tenant_activity_feed AS
SELECT
    a.id::text as event_id,
    a.changed_at as timestamp,
    COALESCE((a.new_values->>'tenant_id')::uuid, (a.old_values->>'tenant_id')::uuid) as tenant_id,
    'DATA_CHANGE' as category,
    CASE 
        WHEN a.operation = 'DELETE' THEN 'WARNING'
        ELSE 'INFO'
    END as severity,
    a.table_name || ' ' || a.operation || ': ' || coalesce(a.record_id::text, '') as summary,
    a.changed_by as actor_id,
    u.email as actor_email,
    jsonb_build_object(
        'table', a.table_name,
        'operation', a.operation,
        'record_id', a.record_id,
        'old', a.old_values,
        'new', a.new_values
    ) as details
FROM audit_logs a
LEFT JOIN auth.users u ON a.changed_by = u.id

UNION ALL

SELECT
    c.id::text as event_id,
    c.created_at as timestamp,
    c.tenant_id,
    'COMMUNICATION' as category,
    'INFO' as severity,
    c.type || ' to ' || c.recipient as summary,
    c.created_by as actor_id,
    u.email as actor_email,
    jsonb_build_object(
        'type', c.type,
        'recipient', c.recipient,
        'direction', c.direction,
        'content', c.content
    ) as details
FROM communications c
LEFT JOIN auth.users u ON c.created_by = u.id;
