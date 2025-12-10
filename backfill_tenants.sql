
-- Disable RLS temporarily or run as superuser (which this connection is)
-- Backfill calendar_feeds
UPDATE calendar_feeds cf
SET tenant_id = p.tenant_id
FROM properties p
WHERE cf.property_id = p.id
  AND cf.tenant_id IS NULL;

-- Backfill bookings
UPDATE bookings b
SET tenant_id = p.tenant_id
FROM properties p
WHERE b.property_id = p.id
  AND b.tenant_id IS NULL;

-- Verify
SELECT count(*) as feeds_still_null FROM calendar_feeds WHERE tenant_id IS NULL;
SELECT count(*) as bookings_still_null FROM bookings WHERE tenant_id IS NULL;
