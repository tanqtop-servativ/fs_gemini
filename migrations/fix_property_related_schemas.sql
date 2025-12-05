-- Fix Property Related Schemas

-- 1. property_access_codes
-- Add code_type column
ALTER TABLE property_access_codes
    ADD COLUMN IF NOT EXISTS code_type text;

-- Rename code to code_value (if code exists and code_value does not)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_access_codes' AND column_name = 'code') THEN
        ALTER TABLE property_access_codes RENAME COLUMN code TO code_value;
    END IF;
END $$;

-- 2. property_assignments
-- Add role_id column
ALTER TABLE property_assignments
    ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id);
