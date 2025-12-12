-- Migration: Add sort_order to jobs table
-- Purpose: Allow correct ordering of jobs in a workflow

ALTER TABLE jobs ADD COLUMN sort_order INTEGER DEFAULT 0;
