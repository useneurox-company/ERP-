-- Create telephony tables

-- Call Scripts
CREATE TABLE IF NOT EXISTS call_scripts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  first_message TEXT,
  voice_id TEXT,
  language TEXT DEFAULT 'ru' NOT NULL,
  llm_model TEXT DEFAULT 'claude-3-5-sonnet',
  max_duration_seconds INTEGER DEFAULT 300,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ElevenLabs Agents
CREATE TABLE IF NOT EXISTS elevenlabs_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  elevenlabs_agent_id TEXT NOT NULL,
  script_id TEXT REFERENCES call_scripts(id) ON DELETE SET NULL,
  phone_number_id TEXT,
  phone_number TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  config TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Call Campaigns
CREATE TABLE IF NOT EXISTS call_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  script_id TEXT REFERENCES call_scripts(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES elevenlabs_agents(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  scheduled_start TIMESTAMP,
  scheduled_end TIMESTAMP,
  call_hours_start TEXT DEFAULT '09:00',
  call_hours_end TEXT DEFAULT '18:00',
  max_concurrent_calls INTEGER DEFAULT 1,
  total_contacts INTEGER DEFAULT 0,
  completed_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Campaign Contacts
CREATE TABLE IF NOT EXISTS campaign_contacts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES call_campaigns(id) ON DELETE CASCADE,
  deal_id TEXT REFERENCES deals(id) ON DELETE SET NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  client_name TEXT,
  company TEXT,
  custom_data TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  call_attempts INTEGER DEFAULT 0,
  last_call_id TEXT,
  scheduled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Call Logs
CREATE TABLE IF NOT EXISTS call_logs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES call_campaigns(id) ON DELETE SET NULL,
  campaign_contact_id TEXT REFERENCES campaign_contacts(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES elevenlabs_agents(id) ON DELETE SET NULL,
  script_id TEXT REFERENCES call_scripts(id) ON DELETE SET NULL,
  deal_id TEXT REFERENCES deals(id) ON DELETE SET NULL,
  client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  elevenlabs_conversation_id TEXT,
  phone_number TEXT NOT NULL,
  direction TEXT DEFAULT 'outbound' NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMP,
  answered_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  outcome TEXT,
  sentiment TEXT,
  summary TEXT,
  transcript TEXT,
  recording_url TEXT,
  cost REAL,
  error_message TEXT,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Call Actions
CREATE TABLE IF NOT EXISTS call_actions (
  id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES call_logs(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_data TEXT,
  timestamp_seconds REAL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
