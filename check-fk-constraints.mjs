import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('\n🔍 Проверка Foreign Key Constraints для таблиц связанных с deals:\n');

const tables = [
  'deal_contacts',
  'deal_messages',
  'deal_documents',
  'deal_attachments',
  'activity_logs',
  'ai_chat_messages',
  'ai_corrections',
  'deal_custom_fields',
  'projects'
];

for (const table of tables) {
  try {
    console.log(`\n📋 Таблица: ${table}`);
    const fkeys = db.prepare(`PRAGMA foreign_key_list(${table})`).all();

    const dealFKeys = fkeys.filter(fk => fk.table === 'deals');

    if (dealFKeys.length > 0) {
      dealFKeys.forEach(fk => {
        console.log(`  ✓ Колонка: ${fk.from}`);
        console.log(`  → Ссылается на: ${fk.table}(${fk.to})`);
        console.log(`  → ON DELETE: ${fk.on_delete}`);
        console.log(`  → ON UPDATE: ${fk.on_update}`);
      });
    } else {
      console.log(`  ⚠️  Нет foreign keys для deals`);
    }
  } catch (error) {
    console.log(`  ❌ Таблица не существует`);
  }
}

console.log('\n\n💡 Включены ли foreign keys?');
const fkEnabled = db.prepare('PRAGMA foreign_keys').get();
console.log(`  ${fkEnabled.foreign_keys ? '✓' : '❌'} foreign_keys = ${fkEnabled.foreign_keys}`);

db.close();
console.log('\n✅ Проверка завершена!\n');
