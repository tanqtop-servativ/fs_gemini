-- Migration: Remove deprecated app_users table
-- Purpose: Clean up legacy authentication table replaced by Supabase Auth + people table
-- Date: 2024-12-08

-- Drop functions that referenced app_users
DROP FUNCTION IF EXISTS create_tenant_with_admin(TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_tenant_with_admin(TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS manage_tenant_user(TEXT, UUID, TEXT, TEXT, TEXT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS manage_tenant_user CASCADE;
DROP FUNCTION IF EXISTS verify_app_access CASCADE;

-- Drop the deprecated table
DROP TABLE IF EXISTS app_users CASCADE;

-- Note: Authentication is now handled by:
-- 1. auth.users (Supabase Auth) - stores credentials
-- 2. people table - stores profile, linked to auth.users via user_id
-- 3. get_my_tenant_id() - resolves tenant from people.tenant_id
