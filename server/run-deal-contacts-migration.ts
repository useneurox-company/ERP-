import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { migrateDealContacts } from './migrations/add_deal_contacts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const localDir = join(__dirname, '../.local');
const dbPath = join(localDir, 'emerald_erp.db');

console.log(`📂 Using database at: ${dbPath}`);

const db = new Database(dbPath);

try {
  migrateDealContacts(db);
  console.log('✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
