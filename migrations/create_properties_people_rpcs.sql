-- Properties Domain RPCs
-- Centralizes property-related business logic in the database

-- ============================================
-- 1. GET PROPERTY DETAIL
-- Returns complete property info with codes, feeds, inventory, photos, attachments
-- ============================================
CREATE OR REPLACE FUNCTION public.get_property_detail(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    prop_record record;
BEGIN
    -- Get property base info from enriched view
    SELECT 
        p.id,
        p.tenant_id,
        p.name,
        p.address AS display_address,
        p.hcp_customer_id,
        p.hcp_address_id,
        p.check_in_time,
        p.check_out_time,
        p.time_zone,
        p.is_dst,
        p.bedrooms,
        p.bathrooms,
        p.max_guests,
        p.has_pool,
        p.has_bbq,
        p.allows_pets,
        p.parking_instructions,
        COALESCE(p.status, 'active') as status,
        p.front_photo_url,
        p.wifi_network,
        p.wifi_password,
        p.has_casita,
        p.square_footage,
        p.bathroom_sinks,
        p.bath_mats
    INTO prop_record
    FROM properties p
    WHERE p.id = p_property_id;
    
    IF prop_record IS NULL THEN
        RETURN jsonb_build_object('error', 'Property not found');
    END IF;
    
    -- Build result with related data
    result := jsonb_build_object(
        'id', prop_record.id,
        'tenant_id', prop_record.tenant_id,
        'name', prop_record.name,
        'display_address', prop_record.display_address,
        'hcp_customer_id', prop_record.hcp_customer_id,
        'hcp_address_id', prop_record.hcp_address_id,
        'check_in_time', prop_record.check_in_time,
        'check_out_time', prop_record.check_out_time,
        'time_zone', prop_record.time_zone,
        'is_dst', prop_record.is_dst,
        'bedrooms', prop_record.bedrooms,
        'bathrooms', prop_record.bathrooms,
        'max_guests', prop_record.max_guests,
        'has_pool', prop_record.has_pool,
        'has_bbq', prop_record.has_bbq,
        'allows_pets', prop_record.allows_pets,
        'parking_instructions', prop_record.parking_instructions,
        'status', prop_record.status,
        'front_photo_url', prop_record.front_photo_url,
        'wifi_network', prop_record.wifi_network,
        'wifi_password', prop_record.wifi_password,
        'has_casita', prop_record.has_casita,
        'square_footage', prop_record.square_footage,
        'bathroom_sinks', prop_record.bathroom_sinks,
        'bath_mats', prop_record.bath_mats,
        'access_codes', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', c.id,
                    'code_type', c.code_type,
                    'code_value', c.code_value
                )
            ), '[]'::jsonb)
            FROM property_access_codes c WHERE c.property_id = p_property_id
        ),
        'feeds', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', f.id,
                    'name', f.name,
                    'url', f.url
                )
            ), '[]'::jsonb)
            FROM calendar_feeds f WHERE f.property_id = p_property_id
        ),
        'inventory', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', i.id,
                    'item_name', i.item_name,
                    'quantity', i.quantity,
                    'category', i.category
                )
            ), '[]'::jsonb)
            FROM property_inventory i WHERE i.property_id = p_property_id
        ),
        'reference_photos', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', rp.id,
                    'photo_url', rp.photo_url,
                    'label', rp.label,
                    'sort_order', rp.sort_order
                ) ORDER BY rp.sort_order
            ), '[]'::jsonb)
            FROM property_reference_photos rp WHERE rp.property_id = p_property_id
        ),
        'attachments', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', a.id,
                    'file_name', a.file_name,
                    'file_url', a.file_url,
                    'created_at', a.created_at
                ) ORDER BY a.created_at DESC
            ), '[]'::jsonb)
            FROM property_attachments a WHERE a.property_id = p_property_id
        ),
        'owners', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', pe.id,
                    'name', TRIM(COALESCE(pe.first_name, '') || ' ' || COALESCE(pe.last_name, ''))
                )
            ), '[]'::jsonb)
            FROM property_assignments pa
            JOIN people pe ON pe.id = pa.person_id
            JOIN roles r ON r.id = pa.role_id
            WHERE pa.property_id = p_property_id AND r.name = 'Owner'
        ),
        'managers', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', pe.id,
                    'name', TRIM(COALESCE(pe.first_name, '') || ' ' || COALESCE(pe.last_name, ''))
                )
            ), '[]'::jsonb)
            FROM property_assignments pa
            JOIN people pe ON pe.id = pa.person_id
            JOIN roles r ON r.id = pa.role_id
            WHERE pa.property_id = p_property_id AND r.name = 'Property Manager'
        )
    );
    
    RETURN result;
END;
$$;

-- ============================================
-- People Domain RPCs
-- ============================================

-- 2. LIST PEOPLE WITH ROLES
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
                'auth_user_id', p.auth_user_id,
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

-- 3. GET PERSON DETAIL
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
        'auth_user_id', person_record.auth_user_id,
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

-- 4. CREATE PERSON
CREATE OR REPLACE FUNCTION public.create_person(
    p_tenant_id uuid,
    p_first_name text,
    p_last_name text,
    p_email text DEFAULT NULL,
    p_phone text DEFAULT NULL,
    p_role_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id uuid;
    role_id uuid;
BEGIN
    INSERT INTO people (tenant_id, first_name, last_name, email, phone)
    VALUES (p_tenant_id, p_first_name, p_last_name, p_email, p_phone)
    RETURNING id INTO new_id;
    
    -- Assign roles
    IF p_role_ids IS NOT NULL THEN
        FOREACH role_id IN ARRAY p_role_ids LOOP
            INSERT INTO person_roles (person_id, role_id) VALUES (new_id, role_id);
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'person_id', new_id);
END;
$$;

-- 5. UPDATE PERSON
CREATE OR REPLACE FUNCTION public.update_person(
    p_person_id uuid,
    p_first_name text,
    p_last_name text,
    p_email text DEFAULT NULL,
    p_phone text DEFAULT NULL,
    p_role_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    role_id uuid;
BEGIN
    UPDATE people
    SET first_name = p_first_name, last_name = p_last_name, email = p_email, phone = p_phone
    WHERE id = p_person_id;
    
    -- Replace roles
    DELETE FROM person_roles WHERE person_id = p_person_id;
    IF p_role_ids IS NOT NULL THEN
        FOREACH role_id IN ARRAY p_role_ids LOOP
            INSERT INTO person_roles (person_id, role_id) VALUES (p_person_id, role_id);
        END LOOP;
    END IF;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. DELETE PERSON
CREATE OR REPLACE FUNCTION public.delete_person(p_person_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM person_roles WHERE person_id = p_person_id;
    DELETE FROM property_assignments WHERE person_id = p_person_id;
    DELETE FROM people WHERE id = p_person_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. LIST ROLES
CREATE OR REPLACE FUNCTION public.list_roles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', id,
                'name', name,
                'description', description
            ) ORDER BY name
        ), '[]'::jsonb)
        FROM roles
    );
END;
$$;
