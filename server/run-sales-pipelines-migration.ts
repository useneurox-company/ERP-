import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { migrateSalesPipelines } from './migrations/add_sales_pipelines.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const localDir = join(__dirname, '../.local');
if (!existsSync(localDir)) {
  mkdirSync(localDir, { recursive: true });
}

const dbPath = join(localDir, 'emerald_erp.db');

console.log(`📂 Using database at: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

try {
  migrateSalesPipelines(db);
  console.log('✅ Sales pipelines migration completed successfully!');
  db.close();
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  db.close();
  process.exit(1);
}
