import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../.local/emerald_erp.db');

if (!existsSync(dbPath)) {
  console.error(`❌ Database not found at: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

console.log('🔧 Fixing missing columns in local database...\n');

try {
  // Get current table info
  const getTableInfo = (tableName) => {
    try {
      return db.prepare(`PRAGMA table_info(${tableName})`).all();
    } catch (e) {
      return null;
    }
  };

  const columnExists = (tableName, columnName) => {
    const info = getTableInfo(tableName);
    if (!info) return false;
    return info.some(col => col.name === columnName);
  };

  // Fix projects table
  if (getTableInfo('projects')) {
    console.log('📋 Checking projects table...');

    if (!columnExists('projects', 'project_number')) {
      console.log('   ➕ Adding project_number column');
      db.prepare(`ALTER TABLE projects ADD COLUMN project_number TEXT`).run();
      console.log('   ✅ Added project_number column');
    } else {
      console.log('   ✓ project_number column already exists');
    }
  } else {
    console.log('⚠️  projects table does not exist');
  }

  // Check other critical tables and columns
  const criticalChecks = [
    { table: 'users', column: 'role_id' },
    { table: 'roles', column: 'is_system' },
    { table: 'role_permissions', column: 'view_all' },
    { table: 'deals', column: 'pipeline_id' },
  ];

  console.log('\n📋 Checking other critical columns...');
  for (const { table, column } of criticalChecks) {
    if (getTableInfo(table)) {
      if (columnExists(table, column)) {
        console.log(`   ✓ ${table}.${column} exists`);
      } else {
        console.log(`   ⚠️  ${table}.${column} is MISSING`);
      }
    }
  }

  console.log('\n✨ Database column fix completed!');
  console.log('💡 Restart your dev server to see the changes');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
