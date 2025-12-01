import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('📂 Migrating database at:', dbPath);

try {
  // Get existing columns
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as any[];
  const columnNames = columns.map(c => c.name);

  console.log('Existing columns:', columnNames);

  // Add new columns if they don't exist
  const newColumns = [
    { name: 'description', type: 'TEXT' },
    { name: 'created_by', type: 'TEXT' },
    { name: 'start_date', type: 'INTEGER' },
    { name: 'completed_at', type: 'INTEGER' },
    { name: 'related_entity_type', type: 'TEXT' },
    { name: 'related_entity_id', type: 'TEXT' },
    { name: 'estimated_hours', type: 'REAL' },
    { name: 'actual_hours', type: 'REAL' },
    { name: 'tags', type: 'TEXT' },
  ];

  for (const col of newColumns) {
    if (!columnNames.includes(col.name)) {
      console.log(`Adding column: ${col.name}`);
      db.exec(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type}`);
    } else {
      console.log(`Column ${col.name} already exists, skipping`);
    }
  }

  // Create new tables if they don't exist

  // Task Comments
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  console.log('✓ task_comments table created/verified');

  // Task Checklist Items
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_checklist_items (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      item_text TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  console.log('✓ task_checklist_items table created/verified');

  // Activity Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      field_changed TEXT,
      old_value TEXT,
      new_value TEXT,
      description TEXT,
      created_at INTEGER NOT NULL
    )
  `);
  console.log('✓ activity_logs table created/verified');

  // Create indexes for better performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_related_entity ON tasks(related_entity_type, related_entity_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`);
  console.log('✓ Indexes created/verified');

  console.log('✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
