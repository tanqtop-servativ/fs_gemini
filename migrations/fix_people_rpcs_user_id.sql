-- Fix for list_people and get_person_detail RPCs
-- The people table uses 'user_id' not 'auth_user_id'

-- 2. LIST PEOPLE WITH ROLES (FIXED)
CREATE OR REPLACE FUNCTION public.list_people(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'first_name', p.first_name,
                'last_name', p.last_name,
                'email', p.email,
                'phone', p.phone,
                'user_id', p.user_id,
                'created_at', p.created_at,
                'roles', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'id', r.id,
                            'name', r.name
                        )
                    ), '[]'::jsonb)
                    FROM person_roles pr
                    JOIN roles r ON r.id = pr.role_id
                    WHERE pr.person_id = p.id
                )
            ) ORDER BY p.first_name, p.last_name
        ), '[]'::jsonb)
        FROM people p
        WHERE p.tenant_id = p_tenant_id
    );
END;
$$;

-- 3. GET PERSON DETAIL (FIXED)
CREATE OR REPLACE FUNCTION public.get_person_detail(p_person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    person_record record;
BEGIN
    SELECT * INTO person_record FROM people WHERE id = p_person_id;
    
    IF person_record IS NULL THEN
        RETURN jsonb_build_object('error', 'Person not found');
    END IF;
    
    RETURN jsonb_build_object(
        'id', person_record.id,
        'first_name', person_record.first_name,
        'last_name', person_record.last_name,
        'email', person_record.email,
        'phone', person_record.phone,
        'user_id', person_record.user_id,
        'tenant_id', person_record.tenant_id,
        'created_at', person_record.created_at,
        'roles', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', r.id,
                    'name', r.name
                )
            ), '[]'::jsonb)
            FROM person_roles pr
            JOIN roles r ON r.id = pr.role_id
            WHERE pr.person_id = p_person_id
        ),
        'property_assignments', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'property_id', prop.id,
                    'property_name', prop.name,
                    'role', r.name
                )
            ), '[]'::jsonb)
            FROM property_assignments pa
            JOIN properties prop ON prop.id = pa.property_id
            JOIN roles r ON r.id = pa.role_id
            WHERE pa.person_id = p_person_id
        )
    );
END;
$$;
