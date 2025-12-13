-- Roles Domain RPCs
-- Migrates CRUD operations from frontend to database

-- 1. List Roles
CREATE OR REPLACE FUNCTION list_roles(
    p_tenant_id UUID,
    p_include_archived BOOLEAN DEFAULT FALSE
)
RETURNS SETOF roles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_include_archived THEN
        RETURN QUERY
        SELECT * FROM roles
        WHERE tenant_id = p_tenant_id
        ORDER BY sort_order, name;
    ELSE
        RETURN QUERY
        SELECT * FROM roles
        WHERE tenant_id = p_tenant_id
          AND deleted_at IS NULL
        ORDER BY sort_order, name;
    END IF;
END;
$$;

-- 2. Create Role
CREATE OR REPLACE FUNCTION create_role(
    p_tenant_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT '',
    p_sort_order INT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id UUID;
BEGIN
    INSERT INTO roles (tenant_id, name, description, sort_order)
    VALUES (p_tenant_id, p_name, p_description, p_sort_order)
    RETURNING id INTO v_role_id;
    
    RETURN v_role_id;
END;
$$;

-- 3. Update Role
CREATE OR REPLACE FUNCTION update_role(
    p_id UUID,
    p_name TEXT,
    p_description TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE roles
    SET name = p_name,
        description = p_description,
        updated_at = NOW()
    WHERE id = p_id;
END;
$$;

-- 4. Archive/Restore Role
CREATE OR REPLACE FUNCTION archive_role(
    p_id UUID,
    p_archive BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE roles
    SET deleted_at = CASE WHEN p_archive THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_id;
END;
$$;

-- 5. Reorder Roles (bulk update sort_order)
CREATE OR REPLACE FUNCTION reorder_roles(
    p_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i INT;
BEGIN
    FOR i IN 1..array_length(p_ids, 1) LOOP
        UPDATE roles
        SET sort_order = i - 1,
            updated_at = NOW()
        WHERE id = p_ids[i];
    END LOOP;
END;
$$;
