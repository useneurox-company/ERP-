import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
console.log(`Using database at: ${dbPath}`);

const db = new Database(dbPath);

// Check if table exists
const tableExists = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name='stage_types'
`).get();

if (tableExists) {
  console.log('✅ stage_types table already exists');
} else {
  console.log('📋 Creating stage_types table...');

  // Create stage_types table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stage_types (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      icon TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  console.log('✅ stage_types table created successfully');
}

// Also check and create process_templates and template_stages if needed
const processTemplatesExists = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name='process_templates'
`).get();

if (!processTemplatesExists) {
  console.log('📋 Creating process_templates table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS process_templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1 NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  console.log('✅ process_templates table created successfully');
} else {
  console.log('✅ process_templates table already exists');
}

const templateStagesExists = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name='template_stages'
`).get();

if (!templateStagesExists) {
  console.log('📋 Creating template_stages table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS template_stages (
      id TEXT PRIMARY KEY NOT NULL,
      template_id TEXT NOT NULL,
      name TEXT NOT NULL,
      stage_type_id TEXT,
      order_num INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (template_id) REFERENCES process_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (stage_type_id) REFERENCES stage_types(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ template_stages table created successfully');
} else {
  console.log('✅ template_stages table already exists');
}

db.close();
console.log('🎉 Database schema update complete!');
