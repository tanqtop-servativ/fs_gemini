-- Add status column to properties table for archive functionality

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
