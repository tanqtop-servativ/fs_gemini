CREATE OR REPLACE FUNCTION public.create_full_person(
    p_first_name text,
    p_last_name text,
    p_email text,
    p_phone text,
    p_tenant_id uuid,
    p_role text DEFAULT 'user',
    p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_person_id uuid;
    v_profile_id uuid;
BEGIN
    -- Check for duplicate email within tenant
    IF EXISTS (
        SELECT 1 FROM people 
        WHERE email = p_email 
        AND tenant_id = p_tenant_id 
        AND deleted_at IS NULL
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'A person with this email already exists in your organization.');
    END IF;

    -- 1. Create Person (roles are handled separately via person_roles table)
    INSERT INTO people (first_name, last_name, email, phone, tenant_id, user_id)
    VALUES (p_first_name, p_last_name, p_email, p_phone, p_tenant_id, p_user_id)
    RETURNING id INTO v_person_id;

    -- 2. Create Profile (if user_id is provided)
    IF p_user_id IS NOT NULL THEN
        INSERT INTO profiles (id, first_name, last_name, email, role, tenant_id)
        VALUES (p_user_id, p_first_name, p_last_name, p_email, p_role, p_tenant_id)
        RETURNING id INTO v_profile_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'person_id', v_person_id,
        'profile_id', v_profile_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
