import Database from "better-sqlite3";
import { join } from "path";

const dbPath = join(process.cwd(), ".local", "emerald_erp.db");
console.log(`📂 Using SQLite database at: ${dbPath}`);

const db = new Database(dbPath);

try {
  console.log("\n🔍 Checking current warehouse_items structure...");

  // Check if old 'category' column exists
  const tableInfo = db.prepare("PRAGMA table_info(warehouse_items)").all();
  const hasOldCategory = tableInfo.some(col => col.name === 'category');
  const hasCategoryId = tableInfo.some(col => col.name === 'category_id');

  console.log(`   Old 'category' column exists: ${hasOldCategory}`);
  console.log(`   New 'category_id' column exists: ${hasCategoryId}`);

  if (!hasOldCategory) {
    console.log("\n✅ Migration not needed - 'category' column already removed");
    process.exit(0);
  }

  console.log("\n📝 Starting migration to remove 'category' column...");

  db.prepare("BEGIN TRANSACTION").run();

  // Step 1: Create new table without 'category' column
  console.log("   1. Creating warehouse_items_new table...");
  db.prepare(`
    CREATE TABLE IF NOT EXISTS warehouse_items_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      reserved_quantity REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL,
      price REAL DEFAULT 0,
      location TEXT,
      category_id TEXT,
      supplier TEXT,
      description TEXT,
      min_stock REAL DEFAULT 0,
      track_min_stock INTEGER DEFAULT 0 NOT NULL,
      status TEXT NOT NULL DEFAULT 'normal',
      project_id TEXT,
      project_name TEXT,
      package_details TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES warehouse_categories(id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `).run();

  // Step 2: Copy all data from old table to new (excluding 'category' column)
  console.log("   2. Copying data from warehouse_items to warehouse_items_new...");
  const itemsCount = db.prepare(`
    INSERT INTO warehouse_items_new
    SELECT
      id, name, sku, barcode, quantity, reserved_quantity, unit, price, location,
      category_id, supplier, description, min_stock, track_min_stock, status,
      project_id, project_name, package_details, created_at, updated_at
    FROM warehouse_items
  `).run();

  console.log(`   ✅ Copied ${itemsCount.changes} items`);

  // Step 3: Drop old table
  console.log("   3. Dropping old warehouse_items table...");
  db.prepare("DROP TABLE warehouse_items").run();

  // Step 4: Rename new table
  console.log("   4. Renaming warehouse_items_new to warehouse_items...");
  db.prepare("ALTER TABLE warehouse_items_new RENAME TO warehouse_items").run();

  db.prepare("COMMIT").run();

  console.log("\n✅ Migration completed successfully!");
  console.log("   Old 'category' column removed");
  console.log("   All data preserved");

} catch (error) {
  console.error("\n❌ Migration failed:", error.message);
  try {
    db.prepare("ROLLBACK").run();
    console.log("   Transaction rolled back");
  } catch (rollbackError) {
    console.error("   Rollback failed:", rollbackError.message);
  }
  process.exit(1);
} finally {
  db.close();
}
