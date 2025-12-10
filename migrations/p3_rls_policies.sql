-- P3: RLS Policies for property_assignments and property_inventory
-- These tables were missing Row-Level Security tenant isolation

-- 1. Enable RLS on property_assignments
ALTER TABLE property_assignments ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on property_inventory
ALTER TABLE property_inventory ENABLE ROW LEVEL SECURITY;

-- 3. Create tenant isolation policy for property_assignments
-- Users can only access assignments for properties that belong to their tenant
CREATE POLICY tenant_isolation ON property_assignments
FOR ALL TO public
USING (
  property_id IN (SELECT id FROM properties WHERE tenant_id = get_my_tenant_id())
)
WITH CHECK (
  property_id IN (SELECT id FROM properties WHERE tenant_id = get_my_tenant_id())
);

-- 4. Create tenant isolation policy for property_inventory
-- Users can only access inventory for properties that belong to their tenant
CREATE POLICY tenant_isolation ON property_inventory
FOR ALL TO public
USING (
  property_id IN (SELECT id FROM properties WHERE tenant_id = get_my_tenant_id())
)
WITH CHECK (
  property_id IN (SELECT id FROM properties WHERE tenant_id = get_my_tenant_id())
);

-- Note: The get_my_tenant_id() function should already exist
-- It returns the tenant_id for the currently authenticated user
