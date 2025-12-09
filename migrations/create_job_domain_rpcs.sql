-- Job Domain RPCs
-- Centralizes job-related business logic in the database

-- ============================================
-- 1. GET JOB DETAIL
-- Returns complete job info with property, tasks, and assignments
-- ============================================
CREATE OR REPLACE FUNCTION public.get_job_detail(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    job_record record;
BEGIN
    -- Get job with property info
    SELECT 
        j.id,
        j.title,
        j.description,
        j.status,
        j.priority,
        j.readable_id,
        j.created_at,
        p.id as property_id,
        p.name as property_name,
        p.address as property_address,
        p.front_photo_url as property_photo,
        so.id as opportunity_id,
        so.title as opportunity_title
    INTO job_record
    FROM jobs j
    LEFT JOIN properties p ON p.id = j.property_id
    LEFT JOIN service_opportunities so ON so.id = j.service_opportunity_id
    WHERE j.id = p_job_id AND j.deleted_at IS NULL;
    
    IF job_record IS NULL THEN
        RETURN jsonb_build_object('error', 'Job not found');
    END IF;
    
    -- Build result
    result := jsonb_build_object(
        'id', job_record.id,
        'title', job_record.title,
        'description', job_record.description,
        'status', job_record.status,
        'priority', job_record.priority,
        'readable_id', job_record.readable_id,
        'created_at', job_record.created_at,
        'property', jsonb_build_object(
            'id', job_record.property_id,
            'name', job_record.property_name,
            'address', job_record.property_address,
            'front_photo_url', job_record.property_photo
        ),
        'opportunity', CASE 
            WHEN job_record.opportunity_id IS NOT NULL THEN 
                jsonb_build_object(
                    'id', job_record.opportunity_id,
                    'title', job_record.opportunity_title
                )
            ELSE NULL
        END,
        'tasks', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', t.id,
                    'title', t.title,
                    'is_completed', t.is_completed
                ) ORDER BY t.id
            ), '[]'::jsonb)
            FROM job_tasks t WHERE t.job_id = p_job_id
        ),
        'assignments', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', ja.id,
                    'person_id', pe.id,
                    'name', TRIM(COALESCE(pe.first_name, '') || ' ' || COALESCE(pe.last_name, '')),
                    'email', pe.email,
                    'created_at', ja.created_at
                )
            ), '[]'::jsonb)
            FROM job_assignments ja
            JOIN people pe ON pe.id = ja.person_id
            WHERE ja.job_id = p_job_id
        )
    );
    
    RETURN result;
END;
$$;

-- ============================================
-- 2. UPDATE JOB STATUS
-- Changes job status with validation
-- ============================================
CREATE OR REPLACE FUNCTION public.update_job_status(
    p_job_id uuid,
    p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_status text;
BEGIN
    -- Valid statuses: Pending, In Progress, Complete, Cancelled
    IF p_new_status NOT IN ('Pending', 'In Progress', 'Complete', 'Cancelled') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
    END IF;
    
    -- Get current status
    SELECT status INTO current_status FROM jobs WHERE id = p_job_id AND deleted_at IS NULL;
    
    IF current_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;
    
    -- Update
    UPDATE jobs 
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_job_id;
    
    RETURN jsonb_build_object('success', true, 'previous_status', current_status, 'new_status', p_new_status);
END;
$$;

-- ============================================
-- 3. TOGGLE JOB TASK
-- Toggles task completion status
-- ============================================
CREATE OR REPLACE FUNCTION public.toggle_job_task(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_completed boolean;
    task_job_id uuid;
BEGIN
    SELECT is_completed, job_id INTO current_completed, task_job_id
    FROM job_tasks WHERE id = p_task_id;
    
    IF current_completed IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found');
    END IF;
    
    UPDATE job_tasks 
    SET is_completed = NOT current_completed, updated_at = NOW()
    WHERE id = p_task_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'task_id', p_task_id,
        'is_completed', NOT current_completed,
        'job_id', task_job_id
    );
END;
$$;

-- ============================================
-- 4. ADD JOB COMMENT
-- ============================================
CREATE OR REPLACE FUNCTION public.add_job_comment(
    p_job_id uuid,
    p_author_id uuid,
    p_content text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id uuid;
BEGIN
    IF TRIM(p_content) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Comment cannot be empty');
    END IF;
    
    INSERT INTO job_comments (job_id, author_id, content)
    VALUES (p_job_id, p_author_id, p_content)
    RETURNING id INTO new_id;
    
    RETURN jsonb_build_object('success', true, 'comment_id', new_id);
END;
$$;

-- ============================================
-- 5. LIST JOB COMMENTS
-- ============================================
CREATE OR REPLACE FUNCTION public.list_job_comments(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'content', c.content,
                'created_at', c.created_at,
                'author', jsonb_build_object(
                    'id', p.id,
                    'name', TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))
                )
            ) ORDER BY c.created_at DESC
        ), '[]'::jsonb)
        FROM job_comments c
        LEFT JOIN people p ON p.id = c.author_id
        WHERE c.job_id = p_job_id
    );
END;
$$;

-- ============================================
-- 6. ADD JOB PHOTO
-- ============================================
CREATE OR REPLACE FUNCTION public.add_job_photo(
    p_job_id uuid,
    p_photo_url text,
    p_caption text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id uuid;
BEGIN
    INSERT INTO job_photos (job_id, photo_url, caption)
    VALUES (p_job_id, p_photo_url, p_caption)
    RETURNING id INTO new_id;
    
    RETURN jsonb_build_object('success', true, 'photo_id', new_id);
END;
$$;

-- ============================================
-- 7. LIST JOB PHOTOS
-- ============================================
CREATE OR REPLACE FUNCTION public.list_job_photos(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', id,
                'photo_url', photo_url,
                'caption', caption,
                'created_at', created_at
            ) ORDER BY created_at DESC
        ), '[]'::jsonb)
        FROM job_photos
        WHERE job_id = p_job_id
    );
END;
$$;

-- ============================================
-- 8. DELETE JOB PHOTO
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_job_photo(p_photo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM job_photos WHERE id = p_photo_id;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- 9. ASSIGN WORKER TO JOB
-- ============================================
CREATE OR REPLACE FUNCTION public.assign_worker_to_job(
    p_job_id uuid,
    p_person_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id uuid;
BEGIN
    -- Check if already assigned
    IF EXISTS (SELECT 1 FROM job_assignments WHERE job_id = p_job_id AND person_id = p_person_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Worker already assigned');
    END IF;
    
    INSERT INTO job_assignments (job_id, person_id)
    VALUES (p_job_id, p_person_id)
    RETURNING id INTO new_id;
    
    RETURN jsonb_build_object('success', true, 'assignment_id', new_id);
END;
$$;

-- ============================================
-- 10. UNASSIGN WORKER FROM JOB
-- ============================================
CREATE OR REPLACE FUNCTION public.unassign_worker_from_job(
    p_job_id uuid,
    p_person_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM job_assignments 
    WHERE job_id = p_job_id AND person_id = p_person_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;
