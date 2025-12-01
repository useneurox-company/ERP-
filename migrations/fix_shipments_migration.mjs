import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('Starting migration fix: shipments and packages');

try {
  // Проверяем существование колонок
  const tableInfo = db.prepare("PRAGMA table_info(warehouse_items)").all();
  const hasProjectName = tableInfo.some(col => col.name === 'project_name');
  const hasPackageDetails = tableInfo.some(col => col.name === 'package_details');

  if (!hasProjectName) {
    console.log('Adding project_name column...');
    db.exec(`ALTER TABLE warehouse_items ADD COLUMN project_name TEXT;`);
  } else {
    console.log('✓ project_name column already exists');
  }

  if (!hasPackageDetails) {
    console.log('Adding package_details column...');
    db.exec(`ALTER TABLE warehouse_items ADD COLUMN package_details TEXT;`);
  } else {
    console.log('✓ package_details column already exists');
  }

  // Проверяем существование таблицы shipments
  const shipmentsExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='shipments'
  `).get();

  if (!shipmentsExists) {
    console.log('Creating shipments table...');
    db.exec(`
      CREATE TABLE shipments (
        id TEXT PRIMARY KEY NOT NULL,
        shipment_number TEXT NOT NULL UNIQUE,
        project_name TEXT NOT NULL,
        delivery_address TEXT,
        warehouse_keeper TEXT NOT NULL,
        status TEXT DEFAULT 'draft' NOT NULL,
        notes TEXT,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        confirmed_at INTEGER,
        cancelled_at INTEGER,
        updated_at INTEGER NOT NULL
      );
    `);
  } else {
    console.log('✓ shipments table already exists');
  }

  // Проверяем существование таблицы shipment_items
  const shipmentItemsExists = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name='shipment_items'
  `).get();

  if (!shipmentItemsExists) {
    console.log('Creating shipment_items table...');
    db.exec(`
      CREATE TABLE shipment_items (
        id TEXT PRIMARY KEY NOT NULL,
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
  } else {
    console.log('✓ shipment_items table already exists');
  }

  console.log('✅ Migration completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
