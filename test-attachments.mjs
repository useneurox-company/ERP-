import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp';
const pool = new Pool({ connectionString: DATABASE_URL });

async function testAttachments() {
  const client = await pool.connect();

  try {
    console.log('🔍 Проверка таблицы task_attachments...');

    // Проверяем существование таблицы
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'task_attachments'
      );
    `);

    console.log('✓ Таблица существует:', checkTable.rows[0].exists);

    // Проверяем структуру таблицы
    const columns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'task_attachments'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Колонки таблицы:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

    // Проверяем количество записей
    const count = await client.query('SELECT COUNT(*) FROM task_attachments');
    console.log('\n📊 Количество записей:', count.rows[0].count);

    console.log('\n✅ Таблица task_attachments готова к работе!\n');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

testAttachments().catch(err => {
  console.error(err);
  process.exit(1);
});
