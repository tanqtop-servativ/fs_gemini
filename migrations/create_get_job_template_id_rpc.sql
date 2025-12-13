-- Simple RPC to get job_template_id for a job
-- Used for worker assignment role filtering

CREATE OR REPLACE FUNCTION public.get_job_template_id(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    template_id uuid;
BEGIN
    SELECT job_template_id INTO template_id
    FROM jobs
    WHERE id = p_job_id AND deleted_at IS NULL;
    
    RETURN template_id;
END;
$$;
