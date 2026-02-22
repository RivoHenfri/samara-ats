-- Migration: Add role_type column to roles table
-- Values: 'Replacement', 'New Position', 'Additional Headcount'
-- Default: NULL (unset for existing roles)

ALTER TABLE roles
ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT NULL;

-- Optional: Add a check constraint to enforce valid values
ALTER TABLE roles
ADD CONSTRAINT roles_role_type_check
CHECK (role_type IS NULL OR role_type IN ('Replacement', 'New Position', 'Additional Headcount'));
