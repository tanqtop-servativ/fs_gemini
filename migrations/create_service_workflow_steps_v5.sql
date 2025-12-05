
-- Drop policies (v4, v3, etc)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Enable read access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable insert access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable update access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable delete access for tenant" ON service_workflow_steps;
    -- Drop older named policies if they exist from v4
    DROP POLICY IF EXISTS "Users can view library tasks for their tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Users can insert library tasks for their tenant" ON service_workflow_steps; 
    -- (The names in v4 were "Enable ... access", but checking just in case)
END $$;

-- Create policies using PROFILES table (Source of Truth)
CREATE POLICY "Enable read access for tenant" ON service_workflow_steps
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Enable insert access for tenant" ON service_workflow_steps
    FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Enable update access for tenant" ON service_workflow_steps
    FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for tenant" ON service_workflow_steps
    FOR DELETE USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));
