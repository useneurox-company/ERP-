import Database from 'better-sqlite3';

const db = new Database('.local/emerald_erp.db');

console.log('=== Fixing warehouse_items schema ===\n');

try {
  // Get current columns
  const columns = db.prepare(`PRAGMA table_info(warehouse_items)`).all();
  console.log('Current columns:');
  columns.forEach(col => console.log(`  - ${col.name}: ${col.type}`));

  // Add missing columns if needed
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('track_min_stock')) {
    console.log('\nAdding track_min_stock column...');
    db.prepare(`ALTER TABLE warehouse_items ADD COLUMN track_min_stock INTEGER DEFAULT 0`).run();
    console.log('✓ Added track_min_stock');
  }

  if (!columnNames.includes('min_stock_level')) {
    console.log('Adding min_stock_level column...');
    db.prepare(`ALTER TABLE warehouse_items ADD COLUMN min_stock_level REAL DEFAULT 0`).run();
    console.log('✓ Added min_stock_level');
  }

  console.log('\n✓ Schema fixed!');

} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
