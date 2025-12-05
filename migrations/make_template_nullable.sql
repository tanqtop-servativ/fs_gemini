-- Make service_template_id nullable in service_opportunities table
ALTER TABLE service_opportunities ALTER COLUMN service_template_id DROP NOT NULL;
