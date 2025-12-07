-- Add snooze_until column and migrate existing Pending to Open

-- Add snooze_until column
ALTER TABLE service_opportunities 
ADD COLUMN IF NOT EXISTS snooze_until TIMESTAMPTZ NULL;

-- Migrate existing 'Pending' status to 'Open'
UPDATE service_opportunities 
SET status = 'Open' 
WHERE status = 'Pending';

-- Note: Status values are currently stored as text, not enforced by enum
-- Supported values: 'Open', 'In Progress', 'Captured', 'Dismissed', 'Snoozed'
