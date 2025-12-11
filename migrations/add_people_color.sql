-- Add color column to people table
-- Stores hex color value like #FF5733 for visual identification

ALTER TABLE people ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- Add comment explaining the column
COMMENT ON COLUMN people.color IS 'Hex color value for visual identification (e.g., #FF5733)';
