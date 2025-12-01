import Database from 'better-sqlite3';

const db = new Database('.local/emerald_erp.db');

try {
  console.log('Creating project_messages table...');

  // Create project_messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ Table project_messages created successfully!');

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON project_messages(project_id);
  `);

  console.log('✅ Index created on project_id');

  // Verify table exists
  const tableCheck = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='project_messages'
  `).get();

  if (tableCheck) {
    console.log('✅ Verification: project_messages table exists');
  } else {
    console.error('❌ Verification failed: table not found');
  }

} catch (error) {
  console.error('❌ Error creating table:', error);
  process.exit(1);
} finally {
  db.close();
}
