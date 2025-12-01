import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');

console.log(`Checking database at: ${dbPath}\n`);

const db = new Database(dbPath);

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

  console.log(`Found ${tables.length} tables:`);
  tables.forEach(table => console.log(`  - ${table.name}`));

  if (tables.length === 0) {
    console.log('\n⚠️  Database has no tables!');
  }

} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
