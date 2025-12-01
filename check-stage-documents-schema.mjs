import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('\n📋 Структура таблицы stage_documents:\n');

try {
  const tableInfo = db.prepare('PRAGMA table_info(stage_documents)').all();

  if (tableInfo.length === 0) {
    console.log('❌ Таблица stage_documents не существует!');
  } else {
    console.table(tableInfo.map(col => ({
      Имя: col.name,
      Тип: col.type,
      NotNull: col.notnull ? 'Да' : 'Нет',
      Default: col.dflt_value || 'NULL',
      PrimaryKey: col.pk ? 'Да' : 'Нет'
    })));
  }
} catch (error) {
  console.log('❌ Ошибка:', error.message);
}

db.close();
console.log('\n✅ Проверка завершена!\n');
