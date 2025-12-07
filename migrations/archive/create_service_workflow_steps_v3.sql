
-- Archive old table if it exists (and hasn't been archived yet)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'service_workflow_steps') THEN
        -- Only rename if it's not the correct schema roughly (check column count or something)
        -- Or just force rename if we are confident. 
        -- Given the previous error, the table might NOT have been created if the policy failed? 
        -- Or it was created but policy failed.
        -- Let's just DROP it this time since it's empty/new from our last attempt.
        -- But to be safe against the ORIGINAL old table, we still want to preserve.
        
        -- Let's check if 'sort_order' column exists. If VALID, don't rename.
        -- If INVALID (old schema), rename.
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'service_workflow_steps' AND column_name = 'sort_order') THEN
             ALTER TABLE service_workflow_steps RENAME TO service_workflow_steps_deprecated_v2;
        END IF;
    END IF;
END $$;

-- Create new table (or ensure it exists)
CREATE TABLE IF NOT EXISTS service_workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID, -- References handled below or simpler
    service_template_id UUID REFERENCES service_templates(id) ON DELETE CASCADE,
    job_template_id UUID REFERENCES job_templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    is_optional BOOLEAN DEFAULT false,
    is_billing BOOLEAN DEFAULT false,
    delay_hours INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add Tenant FK if not exists (separate command to be safe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'service_workflow_steps_tenant_id_fkey') THEN
        ALTER TABLE service_workflow_steps ADD CONSTRAINT service_workflow_steps_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
END $$;


-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_workflow_steps_template ON service_workflow_steps(service_template_id);

-- RLS
ALTER TABLE service_workflow_steps ENABLE ROW LEVEL SECURITY;

-- Drop Policies to recreate
DO $$
BEGIN
    DROP POLICY IF EXISTS "Enable read access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable insert access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable update access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable delete access for tenant" ON service_workflow_steps;
END $$;

-- Corrected Policy Syntax
CREATE POLICY "Enable read access for tenant" ON service_workflow_steps
    FOR SELECT USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY "Enable insert access for tenant" ON service_workflow_steps
    FOR INSERT WITH CHECK (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY "Enable update access for tenant" ON service_workflow_steps
    FOR UPDATE USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);

CREATE POLICY "Enable delete access for tenant" ON service_workflow_steps
    FOR DELETE USING (tenant_id = ((auth.jwt() -> 'app_metadata') ->> 'tenant_id')::uuid);
