
-- Drop old policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Enable read access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable insert access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable update access for tenant" ON service_workflow_steps;
    DROP POLICY IF EXISTS "Enable delete access for tenant" ON service_workflow_steps;
END $$;

-- Create new policies using app_users lookup (consistent with task_library)
CREATE POLICY "Enable read access for tenant" ON service_workflow_steps
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid()));

CREATE POLICY "Enable insert access for tenant" ON service_workflow_steps
    FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid()));

CREATE POLICY "Enable update access for tenant" ON service_workflow_steps
    FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid()));

CREATE POLICY "Enable delete access for tenant" ON service_workflow_steps
    FOR DELETE USING (tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid()));
