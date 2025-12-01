import Database from 'better-sqlite3';

const db = new Database('.local/emerald_erp.db', { readonly: true });

console.log('=== CHECKING LOCAL DATABASE ===\n');

try {
  // Check users
  try {
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log('Users:', users.count);
    if (users.count > 0) {
      const userList = db.prepare('SELECT id, username, full_name FROM users LIMIT 5').all();
      userList.forEach(u => console.log('  -', u.username, '-', u.full_name));
    }
  } catch (e) {
    console.log('Users table error:', e.message);
  }

  // Check deals
  try {
    const deals = db.prepare('SELECT COUNT(*) as count FROM deals').get();
    console.log('\nDeals:', deals.count);
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
