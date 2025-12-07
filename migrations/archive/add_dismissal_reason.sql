-- Add dismissal_reason column to service_opportunities table
ALTER TABLE public.service_opportunities
ADD COLUMN IF NOT EXISTS dismissal_reason TEXT;
