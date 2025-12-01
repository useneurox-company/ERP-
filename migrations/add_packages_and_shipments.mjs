import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('Starting migration: add_packages_and_shipments');

try {
  // 1. Add package-related fields to warehouse_items
  console.log('Adding package fields to warehouse_items...');
  db.exec(`
    ALTER TABLE warehouse_items ADD COLUMN project_name TEXT;
  `);
  db.exec(`
    ALTER TABLE warehouse_items ADD COLUMN package_details TEXT;
  `);
  console.log('✅ Added project_name and package_details columns');

  // 2. Create shipments table
  console.log('Creating shipments table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      shipment_number TEXT NOT NULL UNIQUE,
      project_name TEXT NOT NULL,
      delivery_address TEXT,
      warehouse_keeper TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL,
      confirmed_at INTEGER,
      cancelled_at INTEGER,
      updated_at INTEGER NOT NULL
    );
  `);
  console.log('✅ Created shipments table');

  // 3. Create shipment_items table
  console.log('Creating shipment_items table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipment_items (
      id TEXT PRIMARY KEY,
      shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES warehouse_items(id),
      item_name TEXT NOT NULL,
      item_sku TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      is_package INTEGER DEFAULT 0,
      package_details TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  console.log('✅ Created shipment_items table');

  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
