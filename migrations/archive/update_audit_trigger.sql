CREATE OR REPLACE FUNCTION public.record_audit_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
            DECLARE
                v_old_data jsonb;
                v_new_data jsonb;
                v_user_id uuid;
            BEGIN
                -- Try to get user ID from Supabase Auth
                v_user_id := auth.uid();
                
                IF (TG_OP = 'DELETE') THEN
                    v_old_data := to_jsonb(OLD);
                    v_new_data := null;
                ELSIF (TG_OP = 'INSERT') THEN
                    v_old_data := null;
                    v_new_data := to_jsonb(NEW);
                ELSE
                    -- UPDATE: Check if data actually changed
                    -- We exclude updated_at from the comparison if it exists, but for generic trigger it's hard.
                    -- However, if ONLY updated_at changed, do we want a log? Probably not for "user facing" audit.
                    -- But for system audit yes.
                    -- Given the user complaint, let's strictly check if OLD IS DISTINCT FROM NEW.
                    
                    IF OLD IS NOT DISTINCT FROM NEW THEN
                        RETURN NEW;
                    END IF;
                    
                    v_old_data := to_jsonb(OLD);
                    v_new_data := to_jsonb(NEW);
                END IF;

                INSERT INTO audit_logs (table_name, record_id, operation, changed_by, old_values, new_values)
                VALUES (
                    TG_TABLE_NAME,
                    COALESCE(NEW.id, OLD.id), -- Assumes id is UUID
                    TG_OP,
                    v_user_id,
                    v_old_data,
                    v_new_data
                );
                
                RETURN COALESCE(NEW, OLD);
            END;
            $function$;
