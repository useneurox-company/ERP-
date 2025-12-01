import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../.local/emerald_erp.db');

console.log('🔍 Verifying database integrity...\n');
console.log(`📂 Database: ${dbPath}\n`);

if (!existsSync(dbPath)) {
  console.error(`❌ Database not found at: ${dbPath}`);
  console.log('\n💡 Run "npm run db:reset" to create a new database');
  process.exit(1);
}

const db = new Database(dbPath);

try {
  // Expected schema - critical tables and their critical columns
  const expectedSchema = {
    users: ['id', 'username', 'password', 'role_id', 'is_active'],
    roles: ['id', 'name', 'is_system'],
    role_permissions: ['id', 'role_id', 'module', 'can_view', 'can_create', 'can_edit', 'can_delete', 'view_all'],
    deals: ['id', 'client_name', 'company', 'stage', 'pipeline_id'],
    projects: ['id', 'project_number', 'name', 'client_name', 'deal_id', 'status'],
    project_stages: ['id', 'project_id', 'name', 'stage_type_id', 'status', 'order'],
    stage_types: ['id', 'code', 'name', 'is_active'],
    process_templates: ['id', 'name', 'is_active'],
    template_stages: ['id', 'template_id', 'name', 'stage_type_id', 'order'],
  };

  let hasErrors = false;
  let hasWarnings = false;

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

  // Check each table
  for (const [tableName, expectedColumns] of Object.entries(expectedSchema)) {
    const tableInfo = getTableInfo(tableName);

    if (!tableInfo) {
      console.log(`❌ Table "${tableName}" does NOT exist`);
      hasErrors = true;
      continue;
    }

    console.log(`✓ Table "${tableName}" exists`);

    // Check expected columns
    const missingColumns = [];
    for (const columnName of expectedColumns) {
      if (!columnExists(tableName, columnName)) {
        missingColumns.push(columnName);
      }
    }

    if (missingColumns.length > 0) {
      console.log(`   ⚠️  Missing columns in "${tableName}": ${missingColumns.join(', ')}`);
      hasWarnings = true;
    }
  }

  // Check data integrity
  console.log('\n📊 Checking data integrity...');

  // Check if we have users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  console.log(`   ✓ Users: ${userCount}`);

  if (userCount === 0) {
    console.log('   ⚠️  No users in database - you may need to run seed script');
    hasWarnings = true;
  }

  // Check if we have roles
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get().count;
  console.log(`   ✓ Roles: ${roleCount}`);

  if (roleCount === 0) {
    console.log('   ⚠️  No roles in database - run "node create-roles-and-permissions.mjs"');
    hasWarnings = true;
  }

  // Check if we have stage types
  const stageTypeCount = db.prepare('SELECT COUNT(*) as count FROM stage_types').get().count;
  console.log(`   ✓ Stage types: ${stageTypeCount}`);

  if (stageTypeCount === 0) {
    console.log('   ⚠️  No stage types in database - run "npx tsx server/seed-stage-types.ts"');
    hasWarnings = true;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (hasErrors) {
    console.log('❌ Database verification FAILED - critical issues found');
    console.log('\n💡 Solution: Run "npm run db:reset" to recreate the database');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Database verification PASSED with warnings');
    console.log('\n💡 Some data is missing, but the schema is correct');
    process.exit(0);
  } else {
    console.log('✅ Database verification PASSED - everything looks good!');
    process.exit(0);
  }

} catch (error) {
  console.error('\n❌ Error during verification:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
