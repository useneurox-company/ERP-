import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

const dealId = 'zPmPEyPV-H0gB48alTP21';

console.log(`\n🔍 Проверка зависимостей для сделки ${dealId}:\n`);

// Check all tables that reference deals
const tables = [
  { name: 'deal_messages', column: 'deal_id' },
  { name: 'deal_documents', column: 'deal_id' },
  { name: 'deal_attachments', column: 'deal_id' },
  { name: 'deal_contacts', column: 'deal_id' },
  { name: 'deal_custom_fields', column: 'deal_id' },
  { name: 'projects', column: 'deal_id' },
  { name: 'activity_logs', column: 'deal_id' },
  { name: 'ai_chat_messages', column: 'deal_id' },
  { name: 'ai_corrections', column: 'deal_id' },
];

for (const table of tables) {
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name} WHERE ${table.column} = ?`).get(dealId);
    if (count.count > 0) {
      console.log(`❌ ${table.name}: ${count.count} записей`);

      // Show foreign key info for this table
      const fkeys = db.prepare(`PRAGMA foreign_key_list(${table.name})`).all();
      const dealFKey = fkeys.find(fk => fk.from === table.column);
      if (dealFKey) {
        console.log(`   ON DELETE: ${dealFKey.on_delete}`);
      }
    } else {
      console.log(`✓ ${table.name}: 0 записей`);
    }
  } catch (error) {
    console.log(`⚠️  ${table.name}: таблица не существует`);
  }
}

db.close();
