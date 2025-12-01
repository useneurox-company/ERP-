import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('Создание таблицы stage_documents...\n');

// Проверяем, существует ли уже таблица
const tableExists = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table' AND name='stage_documents'
`).get();

if (tableExists) {
  console.log('✅ Таблица stage_documents уже существует');
} else {
  try {
    db.exec(`
      CREATE TABLE stage_documents (
        id TEXT PRIMARY KEY,
        stage_id TEXT NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
        document_type TEXT NOT NULL,
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        mime_type TEXT,
        metadata TEXT,
        uploaded_by TEXT REFERENCES users(id),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Создаем индексы для оптимизации запросов
    db.exec(`
      CREATE INDEX idx_stage_documents_stage_id ON stage_documents(stage_id);
      CREATE INDEX idx_stage_documents_type ON stage_documents(document_type);
    `);

    console.log('✅ Таблица stage_documents успешно создана');
  } catch (error) {
    console.error('❌ Ошибка создания таблицы stage_documents:', error.message);
  }
}

// Проверяем структуру таблицы
console.log('\n📊 Структура таблицы stage_documents:');
const tableInfo = db.prepare(`PRAGMA table_info(stage_documents)`).all();

if (tableInfo.length > 0) {
  console.table(tableInfo.map(col => ({
    Колонка: col.name,
    Тип: col.type,
    Обязательная: col.notnull ? 'Да' : 'Нет',
    ПоУмолчанию: col.dflt_value || 'NULL',
    ПервичныйКлюч: col.pk ? 'Да' : 'Нет'
  })));
} else {
  console.log('Таблица stage_documents не существует');
}

db.close();
console.log('\n🎉 Операция завершена!');