-- Update job_queue table to match queue_worker.py expectations
-- Add missing columns for action handling, retries, and scheduling

-- Add action_type column (what kind of action to perform)
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS action_type text;

-- Add payload column (JSON data for the action)
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS payload jsonb DEFAULT '{}';

-- Add max_attempts column (retry limit)
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 3;

-- Add run_after column (delayed execution)
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS run_after timestamp with time zone DEFAULT NOW();

-- Add priority column (job priority ordering)
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;

-- Add processed_at column (completion timestamp)
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone;

-- Add error_message column (error details for failed jobs)
ALTER TABLE job_queue 
ADD COLUMN IF NOT EXISTS error_message text;

-- Create index for efficient queue polling
CREATE INDEX IF NOT EXISTS idx_job_queue_pending 
ON job_queue (status, run_after, priority DESC) 
WHERE status = 'PENDING';
