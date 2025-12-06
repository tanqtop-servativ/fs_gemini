-- Migration: Standardize Property Soft Delete
-- Goal: Use deleted_at as the single source of truth for visibility.

-- 1. Find properties that are "archived" via status but not via timestamp
--    Set their deleted_at to NOW()
UPDATE properties
SET deleted_at = NOW()
WHERE status = 'archived' AND deleted_at IS NULL;

-- 2. (Optional) Reset status to 'active' for deleted items to avoid dual-state confusion
--    This is safe because deleted_at IS NOT NULL takes precedence in all our queries now.
UPDATE properties
SET status = 'active'
WHERE status = 'archived';
