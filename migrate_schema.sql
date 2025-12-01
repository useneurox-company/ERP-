-- Migration script to add new fields to tasks table and activity_logs table

-- Add new columns to tasks table if they don't exist
ALTER TABLE tasks ADD COLUMN description TEXT;
ALTER TABLE tasks ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN start_date INTEGER;
ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
ALTER TABLE tasks ADD COLUMN related_entity_type TEXT;
ALTER TABLE tasks ADD COLUMN related_entity_id TEXT;
ALTER TABLE tasks ADD COLUMN estimated_hours REAL;
ALTER TABLE tasks ADD COLUMN actual_hours REAL;
ALTER TABLE tasks ADD COLUMN tags TEXT;

-- Update default values for existing columns
UPDATE tasks SET status = 'new' WHERE status = 'pending';
UPDATE tasks SET priority = 'normal' WHERE priority = 'medium';

-- Remove old permission columns from users table (moved to role_permissions)
-- Note: We should backup data first if needed
-- ALTER TABLE users DROP COLUMN role;
-- ALTER TABLE users DROP COLUMN can_create_deals;
-- ALTER TABLE users DROP COLUMN can_edit_deals;
-- ALTER TABLE users DROP COLUMN can_delete_deals;
