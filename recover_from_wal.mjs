import Database from 'better-sqlite3';
import fs from 'fs';

console.log('=== ATTEMPTING WAL RECOVERY ===\n');

// Copy files to recovery location
fs.copyFileSync('.local/emerald_erp_production_backup.db', '.local/recovery.db');
if (fs.existsSync('.local/emerald_erp_production_backup.db-wal')) {
  fs.copyFileSync('.local/emerald_erp_production_backup.db-wal', '.local/recovery.db-wal');
  console.log('WAL file copied');
}
if (fs.existsSync('.local/emerald_erp_production_backup.db-shm')) {
  fs.copyFileSync('.local/emerald_erp_production_backup.db-shm', '.local/recovery.db-shm');
  console.log('SHM file copied');
}

const db = new Database('.local/recovery.db');

try {
  // Run WAL checkpoint
  console.log('\nRunning WAL checkpoint...');
  db.pragma('wal_checkpoint(RESTART)');
  console.log('Checkpoint complete');

  // Check tables
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
  console.log('\nTables found:', tables.length);

  // Check data
  console.log('\n=== DATA CHECK ===');

  try {
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log('Users:', users.count);
    if (users.count > 0) {
      const userList = db.prepare('SELECT id, username, full_name FROM users LIMIT 10').all();
      userList.forEach(u => console.log('  -', u.username, '-', u.full_name));
    }
  } catch (e) {
    console.log('Users error:', e.message);
  }

  try {
    const deals = db.prepare('SELECT COUNT(*) as count FROM deals').get();
    console.log('\nDeals:', deals.count);
  } catch (e) {
    console.log('Deals error:', e.message);
  }

  try {
    const projects = db.prepare('SELECT COUNT(*) as count FROM projects').get();
    console.log('Projects:', projects.count);
  } catch (e) {
    console.log('Projects error:', e.message);
  }

  try {
    const items = db.prepare('SELECT COUNT(*) as count FROM warehouse_items').get();
    console.log('Warehouse items:', items.count);
  } catch (e) {
    console.log('Warehouse items error:', e.message);
  }

} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
