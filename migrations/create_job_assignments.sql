-- Migration: Create job_assignments table
-- Purpose: Track per-person assignment status and time for jobs

-- 1. Create job_assignments table
CREATE TABLE IF NOT EXISTS job_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id),
    role_id UUID REFERENCES roles(id),
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'assigned' 
        CHECK (status IN ('assigned','en_route','started','paused','finished','no_show','removed')),
    
    -- Timestamps
    en_route_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    
    -- Pause tracking
    cumulative_paused_seconds INTEGER DEFAULT 0,
    last_paused_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(job_id, person_id)
);

-- 2. Add computed_status to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS computed_status TEXT DEFAULT 'unassigned';

-- 3. Enable RLS
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy for tenant isolation
CREATE POLICY "job_assignments_tenant_isolation" ON job_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM jobs j 
            WHERE j.id = job_assignments.job_id 
            AND j.tenant_id = (auth.jwt()->>'tenant_id')::uuid
        )
    );

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_person_id ON job_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_status ON job_assignments(status);

-- 6. Create trigger function to update jobs.computed_status
CREATE OR REPLACE FUNCTION update_job_computed_status()
RETURNS TRIGGER AS $$
DECLARE
    v_job_id UUID;
    v_total INTEGER;
    v_active INTEGER;
    v_finished INTEGER;
    v_en_route INTEGER;
    v_started INTEGER;
    v_new_status TEXT;
BEGIN
    -- Get the job_id from the affected row
    IF TG_OP = 'DELETE' THEN
        v_job_id := OLD.job_id;
    ELSE
        v_job_id := NEW.job_id;
    END IF;
    
    -- Count active assignments (not removed, not no_show)
    SELECT 
        COUNT(*) FILTER (WHERE status NOT IN ('removed', 'no_show')),
        COUNT(*) FILTER (WHERE status = 'finished'),
        COUNT(*) FILTER (WHERE status = 'en_route'),
        COUNT(*) FILTER (WHERE status IN ('started', 'paused'))
    INTO v_active, v_finished, v_en_route, v_started
    FROM job_assignments
    WHERE job_id = v_job_id;
    
    -- Derive status
    IF v_active = 0 THEN
        v_new_status := 'unassigned';
    ELSIF v_active = v_finished THEN
        v_new_status := 'completed';
    ELSIF v_started > 0 THEN
        v_new_status := 'in_progress';
    ELSIF v_en_route > 0 THEN
        v_new_status := 'en_route';
    ELSE
        v_new_status := 'assigned';
    END IF;
    
    -- Update the job
    UPDATE jobs SET computed_status = v_new_status, updated_at = NOW()
    WHERE id = v_job_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger
DROP TRIGGER IF EXISTS trg_update_job_computed_status ON job_assignments;
CREATE TRIGGER trg_update_job_computed_status
    AFTER INSERT OR UPDATE OR DELETE ON job_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_job_computed_status();

-- 8. Enable audit logging for job_assignments
ALTER TABLE job_assignments REPLICA IDENTITY FULL;

-- 9. Grant permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON job_assignments TO authenticated;
