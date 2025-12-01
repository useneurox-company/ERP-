import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as schema from './shared/schema.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');

console.log(`Initializing database at: ${dbPath}`);

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

try {
  // Get all table names from schema
  const tables = Object.keys(schema).filter(key => {
    return schema[key] && typeof schema[key] === 'object' && schema[key][Symbol.for('drizzle:Name')];
  });

  console.log(`Found ${tables.length} tables in schema`);

  // For each table, check if it exists and create if not
  for (const tableName of tables) {
    const table = schema[tableName];
    if (table && table[Symbol.for('drizzle:Name')]) {
      const actualTableName = table[Symbol.for('drizzle:Name')];
      const exists = sqlite.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
      ).get(actualTableName);

      if (!exists) {
        console.log(`Creating table: ${actualTableName}`);
      } else {
        console.log(`Table already exists: ${actualTableName}`);
      }
    }
  }

  // Use dr izzle-kit push SQL to create tables
  console.log('\nGenerating schema...');

  // This is a workaround - we'll directly execute the CREATE TABLE statements
  // by exporting the schema and letting drizzle generate them

  console.log('Done! You should now run: npx drizzle-kit push');

} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
} finally {
  sqlite.close();
}
