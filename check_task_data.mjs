import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('📂 Проверка данных задачи в:', dbPath);

try {
  // Получить структуру таблицы tasks
  console.log('\n=== Структура таблицы tasks ===');
  const schema = db.prepare("PRAGMA table_info(tasks)").all();
  schema.forEach(col => {
    console.log(`  ${col.name}: ${col.type}`);
  });

  // Получить все задачи
  console.log('\n=== Все задачи ===');
  const tasks = db.prepare("SELECT id, title, deadline, created_at, updated_at FROM tasks").all();

  tasks.forEach(task => {
    console.log(`\nЗадача: ${task.title} (ID: ${task.id})`);
    console.log(`  deadline (raw): ${task.deadline} (type: ${typeof task.deadline})`);
    console.log(`  created_at (raw): ${task.created_at} (type: ${typeof task.created_at})`);
    console.log(`  updated_at (raw): ${task.updated_at} (type: ${typeof task.updated_at})`);

    if (task.deadline) {
      const deadlineDate = new Date(task.deadline);
      console.log(`  deadline (parsed): ${deadlineDate.toISOString()}`);
    } else {
      console.log(`  deadline: NULL`);
    }

    if (task.created_at) {
      const createdDate = new Date(task.created_at);
      console.log(`  created_at (parsed): ${createdDate.toISOString()}`);
    }
  });

  console.log('\n✅ Проверка завершена!');
} catch (error) {
  console.error('❌ Ошибка:', error);
  process.exit(1);
} finally {
  db.close();
}
