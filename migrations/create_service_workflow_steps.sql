
CREATE TABLE IF NOT EXISTS service_workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    service_template_id UUID REFERENCES service_templates(id) ON DELETE CASCADE,
    job_template_id UUID REFERENCES job_templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    is_optional BOOLEAN DEFAULT false,
    is_billing BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_workflow_steps_template ON service_workflow_steps(service_template_id);

-- RLS
ALTER TABLE service_workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for tenant" ON service_workflow_steps
    FOR SELECT USING (tenant_id = auth.jwt() ->> 'app_metadata'::text -> 'tenant_id'::text::uuid);

CREATE POLICY "Enable insert access for tenant" ON service_workflow_steps
    FOR INSERT WITH CHECK (tenant_id = auth.jwt() ->> 'app_metadata'::text -> 'tenant_id'::text::uuid);

CREATE POLICY "Enable update access for tenant" ON service_workflow_steps
    FOR UPDATE USING (tenant_id = auth.jwt() ->> 'app_metadata'::text -> 'tenant_id'::text::uuid);

CREATE POLICY "Enable delete access for tenant" ON service_workflow_steps
    FOR DELETE USING (tenant_id = auth.jwt() ->> 'app_metadata'::text -> 'tenant_id'::text::uuid);
