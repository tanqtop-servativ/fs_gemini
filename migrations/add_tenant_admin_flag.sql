-- Add is_tenant_admin flag to profiles table
-- This flag identifies the primary admin for each tenant who can impersonate other users

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_tenant_admin BOOLEAN DEFAULT false;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_tenant_admin ON profiles(is_tenant_admin) WHERE is_tenant_admin = true;

COMMENT ON COLUMN profiles.is_tenant_admin IS 'Primary administrator for the tenant, can impersonate other users for troubleshooting';
