import Database from 'better-sqlite3';

const db = new Database('.local/emerald_erp.db', { readonly: true });

console.log('=== ПОЛНАЯ ПРОВЕРКА БАЗЫ ДАННЫХ ===\n');

try {
  // Все таблицы
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
  console.log(`Всего таблиц: ${tables.length}\n`);

  // Проверяем критичные таблицы с данными
  const criticalTables = [
    'users',
    'deals',
    'deal_messages',
    'projects',
    'tasks',
    'task_comments',
    'warehouse_items'
  ];

  console.log('=== КРИТИЧНЫЕ ТАБЛИЦЫ ===');
  for (const tableName of criticalTables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`✓ ${tableName}: ${count.count} записей`);

      // Проверяем структуру
      if (tableName === 'task_comments') {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        console.log(`  Колонки: ${columns.map(c => c.name).join(', ')}`);
      }
      if (tableName === 'deal_messages') {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        console.log(`  Колонки: ${columns.map(c => c.name).join(', ')}`);
      }
    } catch (e) {
      console.log(`✗ ${tableName}: ОШИБКА - ${e.message}`);
    }
  }

  console.log('\n=== ПРОВЕРКА FOREIGN KEYS ===');
  // Проверяем включены ли foreign keys
  const fkStatus = db.prepare('PRAGMA foreign_keys').get();
  console.log(`Foreign keys enabled: ${fkStatus.foreign_keys === 1 ? 'ДА' : 'НЕТ'}`);

  // Проверяем целостность базы
  console.log('\n=== ПРОВЕРКА ЦЕЛОСТНОСТИ ===');
  const integrity = db.prepare('PRAGMA integrity_check').all();
  console.log(integrity[0]?.integrity_check === 'ok' ? '✓ База данных OK' : '✗ ПРОБЛЕМЫ: ' + JSON.stringify(integrity));

  // Проверяем referential integrity для task_comments
  console.log('\n=== ПРОВЕРКА ССЫЛОЧНОЙ ЦЕЛОСТНОСТИ task_comments ===');
  try {
    const orphanedComments = db.prepare(`
      SELECT tc.id, tc.task_id, tc.author_id
      FROM task_comments tc
      LEFT JOIN tasks t ON tc.task_id = t.id
      LEFT JOIN users u ON tc.author_id = u.id
      WHERE t.id IS NULL OR u.id IS NULL
    `).all();

    if (orphanedComments.length > 0) {
      console.log(`✗ Найдено ${orphanedComments.length} комментариев с несуществующими ссылками:`);
      orphanedComments.forEach(c => {
        console.log(`  - Comment ${c.id}: task=${c.task_id}, author=${c.author_id}`);
      });
    } else {
      console.log('✓ Все ссылки валидны');
    }
  } catch (e) {
    console.log(`Ошибка проверки: ${e.message}`);
  }

  // Проверяем deal_messages
  console.log('\n=== ПРОВЕРКА ССЫЛОЧНОЙ ЦЕЛОСТНОСТИ deal_messages ===');
  try {
    const orphanedMessages = db.prepare(`
      SELECT dm.id, dm.deal_id, dm.author_id
      FROM deal_messages dm
      LEFT JOIN deals d ON dm.deal_id = d.id
      LEFT JOIN users u ON dm.author_id = u.id
      WHERE d.id IS NULL OR u.id IS NULL
    `).all();

    if (orphanedMessages.length > 0) {
      console.log(`✗ Найдено ${orphanedMessages.length} сообщений с несуществующими ссылками:`);
      orphanedMessages.forEach(m => {
        console.log(`  - Message ${m.id}: deal=${m.deal_id}, author=${m.author_id}`);
      });
    } else {
      console.log('✓ Все ссылки валидны');
    }
  } catch (e) {
    console.log(`Ошибка проверки: ${e.message}`);
  }

  // Список всех пользователей
  console.log('\n=== ПОЛЬЗОВАТЕЛИ В БАЗЕ ===');
  const users = db.prepare('SELECT id, username, full_name FROM users').all();
  users.forEach(u => {
    console.log(`  ${u.id} - ${u.username} (${u.full_name || 'без имени'})`);
  });

} catch (error) {
  console.error('ОШИБКА:', error.message);
} finally {
  db.close();
}
