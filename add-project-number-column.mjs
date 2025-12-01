import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');

console.log(`Opening database at: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
  const hasProjectNumber = tableInfo.some(col => col.name === 'project_number');

  if (hasProjectNumber) {
    console.log('✓ project_number column already exists');
  } else {
    console.log('Adding project_number column to projects table...');
    db.prepare('ALTER TABLE projects ADD COLUMN project_number TEXT UNIQUE').run();
    console.log('✓ Successfully added project_number column');
  }

  // Show updated table structure
  console.log('\nUpdated projects table structure:');
  const updatedInfo = db.prepare("PRAGMA table_info(projects)").all();
  console.table(updatedInfo.map(col => ({ name: col.name, type: col.type, notnull: col.notnull, pk: col.pk })));

} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
