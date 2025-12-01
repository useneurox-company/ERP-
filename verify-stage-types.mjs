import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('📊 Checking stage types in database...\n');

// Get all stage types
const stageTypes = db.prepare('SELECT * FROM stage_types ORDER BY code').all();

console.log(`Found ${stageTypes.length} stage types:\n`);
stageTypes.forEach((type, index) => {
  console.log(`${index + 1}. ${type.icon} ${type.name} (${type.code})`);
  console.log(`   Active: ${type.is_active ? 'Yes' : 'No'}`);
  console.log(`   Description: ${type.description || 'N/A'}`);
  console.log('');
});

// Get process templates
const templates = db.prepare('SELECT * FROM process_templates').all();
console.log(`\n📋 Found ${templates.length} process templates:\n`);
templates.forEach((template, index) => {
  console.log(`${index + 1}. ${template.name}`);
  console.log(`   Description: ${template.description || 'N/A'}`);

  // Get stages for this template
  const stages = db.prepare(`
    SELECT ts.*, st.name as type_name, st.icon
    FROM template_stages ts
    LEFT JOIN stage_types st ON ts.stage_type_id = st.id
    WHERE ts.template_id = ?
    ORDER BY ts."order"
  `).all(template.id);

  console.log(`   Stages (${stages.length}):`);
  stages.forEach(stage => {
    console.log(`      - ${stage.icon || ''} ${stage.name} (Type: ${stage.type_name || 'N/A'})`);
  });
  console.log('');
});

db.close();
console.log('✅ Verification complete!');
