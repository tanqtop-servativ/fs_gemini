-- Add deleted_at column to attachment tables for soft delete

ALTER TABLE property_attachments
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE property_reference_photos
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
