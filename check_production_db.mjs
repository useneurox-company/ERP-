import Database from 'better-sqlite3';

const db = new Database('.local/emerald_erp_production_backup.db', { readonly: true });

console.log('=== CHECKING PRODUCTION DATABASE ===\n');

try {
  // Get all tables
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
  console.log('Tables in database:', tables.length);
  tables.forEach(t => console.log('  -', t.name));

  console.log('\n=== CHECKING DATA ===');

  // Check users
  try {
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log('Users:', users.count);
  } catch (e) {
    console.log('Users table error:', e.message);
  }

  // Check deals
  try {
    const deals = db.prepare('SELECT COUNT(*) as count FROM deals').get();
    console.log('Deals:', deals.count);
  } catch (e) {
    console.log('Deals table error:', e.message);
  }

  // Check projects
  try {
    const projects = db.prepare('SELECT COUNT(*) as count FROM projects').get();
    console.log('Projects:', projects.count);
  } catch (e) {
    console.log('Projects table error:', e.message);
  }

  // Check warehouse_items
  try {
    const items = db.prepare('SELECT COUNT(*) as count FROM warehouse_items').get();
    console.log('Warehouse items:', items.count);
  } catch (e) {
    console.log('Warehouse items table error:', e.message);
  }

} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
