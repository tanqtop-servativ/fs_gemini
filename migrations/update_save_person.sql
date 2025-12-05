CREATE OR REPLACE FUNCTION public.save_person_safe(
    p_id uuid,
    p_tenant_id uuid,
    p_first text,
    p_last text,
    p_email text,
    p_role_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
            DECLARE
                v_person_id uuid;
                v_old_role_names text[];
                v_new_role_names text[];
                r_id uuid;
            BEGIN
                -- Check for duplicate email within tenant (excluding self)
                IF EXISTS (
                    SELECT 1 FROM people 
                    WHERE email = p_email 
                    AND tenant_id = p_tenant_id 
                    AND id != COALESCE(p_id, '00000000-0000-0000-0000-000000000000'::uuid)
                    AND deleted_at IS NULL
                ) THEN
                    RAISE EXCEPTION 'A person with this email already exists in your organization.';
                END IF;

                -- A. Update Person
                IF p_id IS NULL THEN
                    INSERT INTO people (tenant_id, first_name, last_name, email)
                    VALUES (p_tenant_id, p_first, p_last, p_email)
                    RETURNING id INTO v_person_id;
                ELSE
                    -- Update only if changed (to avoid audit log if no change)
                    UPDATE people 
                    SET first_name = p_first, last_name = p_last, email = p_email
                    WHERE id = p_id 
                    AND (first_name IS DISTINCT FROM p_first OR last_name IS DISTINCT FROM p_last OR email IS DISTINCT FROM p_email);
                    
                    v_person_id := p_id;
                    
                    -- Capture old role names for audit
                    SELECT array_agg(r.name ORDER BY r.name) 
                    INTO v_old_role_names 
                    FROM person_roles pr 
                    JOIN roles r ON pr.role_id = r.id 
                    WHERE pr.person_id = v_person_id;
                    
                    -- Wipe old roles
                    DELETE FROM person_roles WHERE person_id = v_person_id;
                END IF;

                -- B. Insert Roles
                IF p_role_ids IS NOT NULL AND array_length(p_role_ids, 1) > 0 THEN
                    -- Capture new role names for audit
                    SELECT array_agg(name ORDER BY name) 
                    INTO v_new_role_names 
                    FROM roles 
                    WHERE id = ANY(p_role_ids);
                    
                    FOREACH r_id IN ARRAY p_role_ids
                    LOOP
                        INSERT INTO person_roles (person_id, role_id) VALUES (v_person_id, r_id);
                    END LOOP;
                ELSE
                    v_new_role_names := NULL;
                END IF;
                
                -- C. Audit Log for Roles (Only if existing person)
                IF p_id IS NOT NULL AND (v_old_role_names IS DISTINCT FROM v_new_role_names) THEN
                     INSERT INTO audit_logs (table_name, record_id, operation, changed_by, old_values, new_values)
                     VALUES (
                        'people',
                        v_person_id,
                        'UPDATE',
                        auth.uid(),
                        jsonb_build_object('assigned_roles', COALESCE(v_old_role_names, ARRAY[]::text[])),
                        jsonb_build_object('assigned_roles', COALESCE(v_new_role_names, ARRAY[]::text[]))
                     );
                END IF;

                RETURN v_person_id;
            END;
            $function$;
