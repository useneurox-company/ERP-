-- Create missing tables for Emerald ERP (with TEXT id types)

-- user_roles
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    role VARCHAR(50) NOT NULL,
    project_id TEXT REFERENCES projects(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- task_potential_assignees
CREATE TABLE IF NOT EXISTS task_potential_assignees (
    id SERIAL PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- task_checklists
CREATE TABLE IF NOT EXISTS task_checklists (
    id SERIAL PRIMARY KEY,
    task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    "order" INTEGER DEFAULT 0,
    hide_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- stage_deadline_history
CREATE TABLE IF NOT EXISTS stage_deadline_history (
    id SERIAL PRIMARY KEY,
    stage_id TEXT REFERENCES project_stages(id) ON DELETE CASCADE,
    changed_by TEXT REFERENCES users(id),
    old_planned_start TIMESTAMP,
    old_planned_end TIMESTAMP,
    new_planned_start TIMESTAMP,
    new_planned_end TIMESTAMP,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- board_card_checklists
CREATE TABLE IF NOT EXISTS board_card_checklists (
    id SERIAL PRIMARY KEY,
    card_id TEXT REFERENCES board_cards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    "order" INTEGER DEFAULT 0,
    hide_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- board_card_checklist_items
CREATE TABLE IF NOT EXISTS board_card_checklist_items (
    id SERIAL PRIMARY KEY,
    checklist_id INTEGER REFERENCES board_card_checklists(id) ON DELETE CASCADE,
    card_id TEXT REFERENCES board_cards(id) ON DELETE CASCADE,
    item_text TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    assignee_id TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- board_card_members
CREATE TABLE IF NOT EXISTS board_card_members (
    id SERIAL PRIMARY KEY,
    card_id TEXT REFERENCES board_cards(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- board_card_potential_assignees
CREATE TABLE IF NOT EXISTS board_card_potential_assignees (
    id SERIAL PRIMARY KEY,
    card_id TEXT REFERENCES board_cards(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- campaign_contacts (telephony)
CREATE TABLE IF NOT EXISTS campaign_contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES call_campaigns(id) ON DELETE CASCADE,
    deal_id TEXT REFERENCES deals(id),
    client_id TEXT REFERENCES clients(id),
    phone_number VARCHAR(50) NOT NULL,
    client_name VARCHAR(255),
    company VARCHAR(255),
    custom_data JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    call_attempts INTEGER DEFAULT 0,
    last_call_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- call_logs
CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES call_campaigns(id),
    campaign_contact_id INTEGER REFERENCES campaign_contacts(id),
    agent_id INTEGER REFERENCES elevenlabs_agents(id),
    script_id INTEGER REFERENCES call_scripts(id),
    deal_id TEXT REFERENCES deals(id),
    client_id TEXT REFERENCES clients(id),
    phone_number VARCHAR(50),
    direction VARCHAR(20) DEFAULT 'outbound',
    status VARCHAR(50) DEFAULT 'initiated',
    started_at TIMESTAMP,
    answered_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    outcome VARCHAR(50),
    sentiment VARCHAR(50),
    summary TEXT,
    transcript JSONB,
    recording_url TEXT,
    cost NUMERIC(10,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- call_actions
CREATE TABLE IF NOT EXISTS call_actions (
    id SERIAL PRIMARY KEY,
    call_id INTEGER REFERENCES call_logs(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    action_data JSONB,
    timestamp_seconds NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
