import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local/emerald_erp.db');
const db = new Database(dbPath);

console.log('📂 Checking database at:', dbPath);
console.log('\n');

const tableInfo = db.prepare('PRAGMA table_info(projects)').all();

console.log('📋 projects table columns:');
console.log('==========================');
tableInfo.forEach(col => {
  console.log(`  ${col.name} (${col.type})`);
});

db.close();
