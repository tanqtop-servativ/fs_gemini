-- P2: Address column rename, display_address generation, and time defaults
-- Run this migration after P1 indexes migration

-- 1. Rename address → street_address for clarity
ALTER TABLE properties RENAME COLUMN address TO street_address;

-- 2. Add generated display_address column (concatenates address parts)
ALTER TABLE properties ADD COLUMN display_address TEXT 
  GENERATED ALWAYS AS (
    COALESCE(street_address, '') || 
    CASE WHEN city IS NOT NULL AND city != '' THEN ', ' || city ELSE '' END ||
    CASE WHEN state IS NOT NULL AND state != '' THEN ', ' || state ELSE '' END ||
    CASE WHEN zip IS NOT NULL AND zip != '' THEN ' ' || zip ELSE '' END
  ) STORED;

-- 3. Add default values for time-related columns
ALTER TABLE properties ALTER COLUMN check_in_time SET DEFAULT '16:00:00';
ALTER TABLE properties ALTER COLUMN check_out_time SET DEFAULT '10:00:00';
ALTER TABLE properties ALTER COLUMN time_zone SET DEFAULT 'US/Mountain';

-- 4. Backfill existing rows that have NULL values
UPDATE properties SET check_in_time = '16:00:00' WHERE check_in_time IS NULL;
UPDATE properties SET check_out_time = '10:00:00' WHERE check_out_time IS NULL;
UPDATE properties SET time_zone = 'US/Mountain' WHERE time_zone IS NULL;
