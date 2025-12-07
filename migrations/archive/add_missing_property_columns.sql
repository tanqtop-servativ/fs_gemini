-- Add missing columns to properties table

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS hcp_customer_id text,
    ADD COLUMN IF NOT EXISTS hcp_address_id text,
    ADD COLUMN IF NOT EXISTS check_in_time time without time zone,
    ADD COLUMN IF NOT EXISTS check_out_time time without time zone,
    ADD COLUMN IF NOT EXISTS front_photo_url text,
    ADD COLUMN IF NOT EXISTS wifi_network text,
    ADD COLUMN IF NOT EXISTS wifi_password text,
    ADD COLUMN IF NOT EXISTS bedrooms integer,
    ADD COLUMN IF NOT EXISTS bathrooms numeric,
    ADD COLUMN IF NOT EXISTS max_guests integer,
    ADD COLUMN IF NOT EXISTS has_pool boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS has_bbq boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS allows_pets boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS parking_instructions text,
    ADD COLUMN IF NOT EXISTS has_casita boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS casita_code text,
    ADD COLUMN IF NOT EXISTS square_footage integer,
    ADD COLUMN IF NOT EXISTS bathroom_sinks integer,
    ADD COLUMN IF NOT EXISTS bath_mats integer,
    ADD COLUMN IF NOT EXISTS time_zone text,
    ADD COLUMN IF NOT EXISTS is_dst boolean DEFAULT false;
