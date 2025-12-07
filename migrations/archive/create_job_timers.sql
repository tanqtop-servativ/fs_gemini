CREATE TABLE IF NOT EXISTS job_timers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    stopped_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for querying active timers
CREATE INDEX IF NOT EXISTS idx_job_timers_user_active ON job_timers(user_id) WHERE stopped_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_timers_job ON job_timers(job_id);
