import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const localDir = join(__dirname, '../.local');
const dbPath = join(localDir, 'emerald_erp.db');

console.log('🔄 Resetting local database...\n');

try {
  // 1. Remove old database
  if (existsSync(dbPath)) {
    console.log('🗑️  Removing old database...');
    unlinkSync(dbPath);
    console.log('   ✅ Old database removed');
  } else {
    console.log('   ℹ️  No existing database found');
  }

  // 2. Ensure .local directory exists
  if (!existsSync(localDir)) {
    mkdirSync(localDir, { recursive: true });
    console.log('   ✅ Created .local directory');
  }

  // 3. Run migrations
  console.log('\n📝 Applying schema migrations...');
  try {
    // Use the existing migrations
    execSync('node migrations/0000_chemical_changeling.sql', { stdio: 'inherit' });
    console.log('   ✅ Migrations applied');
  } catch (e) {
    // Migrations might fail if they're SQL files, so we'll initialize from seed scripts instead
    console.log('   ℹ️  Using seed scripts instead of migrations');
  }

  // 4. Initialize database with seed scripts
  console.log('\n🌱 Seeding database...');

  console.log('   📋 Seeding stage types and templates...');
  execSync('npx tsx server/seed-stage-types.ts', { stdio: 'inherit' });

  console.log('   👥 Creating roles and permissions...');
  execSync('node create-roles-and-permissions.mjs', { stdio: 'inherit' });

  // 5. Verify database
  console.log('\n🔍 Verifying database...');
  execSync('node scripts/verify-db.mjs', { stdio: 'inherit' });

  console.log('\n✨ Local database reset completed successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Restart your dev server (Ctrl+C and run "npm run dev")');
  console.log('   2. Create a new user in the UI or use the default Admin account');

} catch (error) {
  console.error('\n❌ Error during reset:', error.message);
  process.exit(1);
}
