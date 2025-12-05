
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS uid TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_uid ON bookings(uid);
