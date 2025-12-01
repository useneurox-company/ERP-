import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

// Get table schema
const tableInfo = db.prepare(`PRAGMA table_info(template_stages)`).all();

console.log('Current template_stages table structure:');
console.table(tableInfo);

db.close();
