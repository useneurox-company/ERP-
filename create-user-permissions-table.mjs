import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create .local directory if it doesn't exist
const localDir = join(__dirname, '.local');
if (!existsSync(localDir)) {
  mkdirSync(localDir, { recursive: true });
}

const dbPath = join(localDir, 'emerald_erp.db');
const db = new Database(dbPath);

console.log('📂 Using database at:', dbPath);

try {
  // Check if table already exists
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='user_permissions'
  `).get();

  if (tableExists) {
    console.log('✓ Table user_permissions already exists');
    db.close();
    process.exit(0);
  }

  console.log('Creating user_permissions table...');

  // Create user_permissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      module TEXT NOT NULL,
      can_view INTEGER DEFAULT 0 NOT NULL,
      can_create INTEGER DEFAULT 0 NOT NULL,
      can_edit INTEGER DEFAULT 0 NOT NULL,
      can_delete INTEGER DEFAULT 0 NOT NULL,
      view_all INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id
    ON user_permissions(user_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_user_permissions_module
    ON user_permissions(module);
  `);

  console.log('✓ Table user_permissions created successfully');
  console.log('✓ Indexes created successfully');

  db.close();
  console.log('\n✨ Migration completed successfully!');
} catch (error) {
  console.error('❌ Error creating user_permissions table:', error);
  db.close();
  process.exit(1);
}
