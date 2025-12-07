-- Create job_template_roles junction table
CREATE TABLE IF NOT EXISTS job_template_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(job_template_id, role_id)
);

-- Enable RLS
ALTER TABLE job_template_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see/modify roles for templates in their tenant
CREATE POLICY "tenant_isolation" ON job_template_roles
    FOR ALL
    USING (
        job_template_id IN (
            SELECT id FROM job_templates 
            WHERE tenant_id = (SELECT tenant_id FROM people WHERE user_id = auth.uid())
        )
    );

-- Grant access
GRANT ALL ON job_template_roles TO authenticated;
