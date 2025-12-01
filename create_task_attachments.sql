-- Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- Create task_checklist_items table
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id TEXT PRIMARY KEY NOT NULL,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_completed INTEGER DEFAULT 0 NOT NULL,
  "order" INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER NOT NULL
);
