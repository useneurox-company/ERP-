import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('Starting migration: add_project_id_to_warehouse_items');

try {
  // Add project_id column to warehouse_items table
  db.exec(`
    ALTER TABLE warehouse_items ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
  `);

  console.log('✅ Successfully added project_id column to warehouse_items table');
  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
