-- Add missing columns to existing tables

-- =====================
-- board_cards
-- =====================
ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS taken_at TIMESTAMP;
ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) DEFAULT 'assigned';
ALTER TABLE board_cards ADD COLUMN IF NOT EXISTS created_by TEXT;

-- =====================
-- tasks
-- =====================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS taken_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) DEFAULT 'assigned';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_entity_type VARCHAR(50);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS related_entity_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_item_id TEXT REFERENCES project_items(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_status VARCHAR(20);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- =====================
-- sip_trunks
-- =====================
ALTER TABLE sip_trunks ADD COLUMN IF NOT EXISTS transport VARCHAR(10) DEFAULT 'udp';
ALTER TABLE sip_trunks ADD COLUMN IF NOT EXISTS last_connected_at TIMESTAMP;
ALTER TABLE sip_trunks ADD COLUMN IF NOT EXISTS config JSONB;
ALTER TABLE sip_trunks ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id);

-- =====================
-- call_scripts
-- =====================
ALTER TABLE call_scripts ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id);

-- =====================
-- elevenlabs_agents
-- =====================
ALTER TABLE elevenlabs_agents ADD COLUMN IF NOT EXISTS config JSONB;

-- =====================
-- call_campaigns
-- =====================
ALTER TABLE call_campaigns ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES users(id);

-- =====================
-- call_logs
-- =====================
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS elevenlabs_conversation_id VARCHAR(255);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- =====================
-- project_items (if missing source_document_id)
-- =====================
ALTER TABLE project_items ADD COLUMN IF NOT EXISTS source_document_id TEXT;

-- =====================
-- board_card_checklists
-- =====================
ALTER TABLE board_card_checklists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =====================
-- board_card_checklist_items
-- =====================
ALTER TABLE board_card_checklist_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =====================
-- task_checklists (recreate if wrong types)
-- =====================
-- Note: If task_checklists has INTEGER id instead of TEXT, drop and recreate:
-- DROP TABLE IF EXISTS task_checklist_items;
-- DROP TABLE IF EXISTS task_checklists;
-- Then run create_missing_tables.sql with correct TEXT types

ALTER TABLE task_checklists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- =====================
-- task_checklist_items
-- =====================
ALTER TABLE task_checklist_items ADD COLUMN IF NOT EXISTS checklist_id TEXT;
ALTER TABLE task_checklist_items ADD COLUMN IF NOT EXISTS deadline TEXT;
ALTER TABLE task_checklist_items ADD COLUMN IF NOT EXISTS assignee_id TEXT;

-- =====================
-- tasks (is_archived)
-- =====================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- =====================
-- Verify changes
-- =====================
SELECT 'board_cards columns:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'board_cards' ORDER BY ordinal_position;

SELECT 'tasks columns:' as info;
SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' ORDER BY ordinal_position;
