-- Fix Property Reference Photos Schema
-- 1. Rename description to label if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_reference_photos' AND column_name = 'description') THEN
        ALTER TABLE property_reference_photos RENAME COLUMN description TO label;
    END IF;
END $$;

-- 2. Add is_reference
ALTER TABLE property_reference_photos
    ADD COLUMN IF NOT EXISTS is_reference boolean DEFAULT false;

-- 3. Add compression_status
ALTER TABLE property_reference_photos
    ADD COLUMN IF NOT EXISTS compression_status text DEFAULT 'pending';

-- 4. Add readable_id if missing (it was in the inspect output, but good to be safe for consistency across envs)
ALTER TABLE property_reference_photos
    ADD COLUMN IF NOT EXISTS readable_id text;
