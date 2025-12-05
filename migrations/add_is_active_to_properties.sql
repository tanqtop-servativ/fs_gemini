-- Add is_active column to properties table for scheduling status

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
