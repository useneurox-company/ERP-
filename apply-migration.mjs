import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const migrationPath = join(__dirname, 'migrations', '0000_chemical_changeling.sql');

console.log(`📂 Database: ${dbPath}`);
console.log(`📄 Migration: ${migrationPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Read and execute the migration SQL
const sql = readFileSync(migrationPath, 'utf-8');

// Split by statement breakpoint and execute each statement
const statements = sql.split('--> statement-breakpoint');

console.log(`\n⚡ Applying ${statements.length} statements...`);

let successCount = 0;
for (const statement of statements) {
  const trimmed = statement.trim();
  if (trimmed && trimmed.length > 0) {
    try {
      db.exec(trimmed);
      successCount++;
    } catch (error) {
      console.error(`❌ Error executing statement: ${error.message}`);
      console.error(`Statement: ${trimmed.substring(0, 100)}...`);
    }
  }
}

console.log(`\n✅ Successfully applied ${successCount} statements`);

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(`\n📋 Database tables (${tables.length} total):`);
tables.forEach(table => console.log(`   - ${table.name}`));

db.close();
console.log(`\n🎉 Migration completed!`);
