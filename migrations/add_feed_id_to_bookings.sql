
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS feed_id UUID REFERENCES calendar_feeds(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ical_summary TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_feed_id ON bookings(feed_id);
