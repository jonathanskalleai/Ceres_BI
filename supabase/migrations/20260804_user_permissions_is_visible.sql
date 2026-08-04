-- Migration: Add is_visible column to user_permissions table
-- Purpose: Allow hiding modules from sidebar while keeping route accessible
-- Default: true (backward compatible with existing permissions)

ALTER TABLE user_permissions
ADD COLUMN IF NOT EXISTS is_visible boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN user_permissions.is_visible IS
  'When false, the module is hidden from the sidebar but the route remains accessible. Default true for backward compatibility.';
