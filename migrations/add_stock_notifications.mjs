import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../.local/emerald_erp.db');
const db = new Database(dbPath);

console.log('📦 Running migration: add_stock_notifications...');

try {
  // Add track_min_stock column to warehouse_items
  console.log('Adding track_min_stock column to warehouse_items...');
  db.exec(`
    ALTER TABLE warehouse_items
    ADD COLUMN track_min_stock INTEGER DEFAULT 0 NOT NULL;
  `);
  console.log('✅ Added track_min_stock column');

  // Create stock_notifications table
  console.log('Creating stock_notifications table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_notifications (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      status TEXT NOT NULL,
      quantity REAL NOT NULL,
      min_stock REAL NOT NULL,
      user_id TEXT REFERENCES users(id),
      read INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  console.log('✅ Created stock_notifications table');

  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
