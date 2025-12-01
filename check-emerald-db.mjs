import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'emerald_erp.db');

console.log(`Checking database at: ${dbPath}\n`);

try {
  const db = new Database(dbPath, { readonly: true });

  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

    console.log(`Found ${tables.length} tables:`);
    tables.forEach(table => console.log(`  - ${table.name}`));

    if (tables.length === 0) {
      console.log('\n⚠️  Database has no tables!');
    } else {
      // Check if projects table exists and has data
      if (tables.some(t => t.name === 'projects')) {
        const count = db.prepare("SELECT COUNT(*) as count FROM projects").get();
        console.log(`\nProjects table has ${count.count} rows`);

        // Check columns in projects table
        const columns = db.prepare("PRAGMA table_info(projects)").all();
        console.log('\nProjects table columns:');
        columns.forEach(col => console.log(`  - ${col.name} (${col.type})`));
      }

      // Check deals table
      if (tables.some(t => t.name === 'deals')) {
        const count = db.prepare("SELECT COUNT(*) as count FROM deals").get();
        console.log(`\nDeals table has ${count.count} rows`);
      }
    }
  } finally {
    db.close();
  }
} catch (error) {
  console.error('Error:', error.message);
}
