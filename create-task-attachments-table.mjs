import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = process.argv[2] || 'postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp';

const pool = new Pool({ connectionString: DATABASE_URL });

async function createTaskAttachmentsTable() {
  const client = await pool.connect();

  try {
    console.log('🔍 Проверка таблицы task_attachments...');
    console.log('⚠️  ВНИМАНИЕ: Скрипт только СОЗДАЕТ таблицу, данные НЕ удаляются!\n');

    // Проверяем существование таблицы
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'task_attachments'
      );
    `);

    if (checkTable.rows[0].exists) {
      console.log('✓ Таблица task_attachments уже существует');
      console.log('\n🎉 Миграция не требуется!\n');
      return;
    }

    console.log('➕ Создание таблицы task_attachments...');

    // Создаем таблицу
    await client.query(`
      CREATE TABLE task_attachments (
        id text PRIMARY KEY,
        task_id text NOT NULL,
        file_name text NOT NULL,
        file_path text NOT NULL,
        file_size integer,
        mime_type text,
        uploaded_by text,
        created_at timestamp NOT NULL,
        CONSTRAINT fk_task_attachments_task_id
          FOREIGN KEY (task_id)
          REFERENCES tasks(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_task_attachments_uploaded_by
          FOREIGN KEY (uploaded_by)
          REFERENCES users(id)
      );
    `);

    console.log('✅ Таблица task_attachments создана');

    // Создаем индекс для быстрых запросов
    console.log('➕ Создание индекса...');
    await client.query(`
      CREATE INDEX idx_task_attachments_task_id
      ON task_attachments(task_id);
    `);
    console.log('✅ Индекс создан');

    console.log('\n📊 Результат миграции:');
    console.log('   ✅ Таблица task_attachments создана');
    console.log('   ✅ Индекс на task_id создан');
    console.log('   ✅ Foreign keys настроены');
    console.log('\n🎉 Миграция завершена успешно!\n');

  } catch (error) {
    console.error('\n❌ Ошибка миграции:', error.message);
    console.error(error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createTaskAttachmentsTable().catch(err => {
  console.error(err);
  process.exit(1);
});
