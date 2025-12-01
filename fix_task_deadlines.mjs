import Database from 'better-sqlite3';
import { join } from 'path';

const dbPath = join(process.cwd(), '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('📂 Исправление типов дат в таблице tasks');
console.log('База:', dbPath);

try {
  // Step 1: Создаем новую таблицу с правильными типами
  console.log('\n1. Создание временной таблицы...');
  db.exec(`
    CREATE TABLE tasks_new (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      assignee_id TEXT,
      created_by TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      deadline TEXT,
      start_date TEXT,
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      related_entity_type TEXT,
      related_entity_id TEXT,
      deal_id TEXT,
      project_id TEXT,
      project_stage_id TEXT,
      submitted_for_review_at TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_status TEXT,
      rejection_reason TEXT,
      estimated_hours REAL,
      actual_hours REAL,
      tags TEXT,
      attachments_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (assignee_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (project_stage_id) REFERENCES project_stages(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );
  `);

  // Step 2: Копируем данные с явным указанием колонок
  console.log('2. Копирование данных...');
  db.exec(`
    INSERT INTO tasks_new (
      id, title, description, assignee_id, created_by, priority, deadline, start_date, completed_at,
      status, related_entity_type, related_entity_id, deal_id, project_id, project_stage_id,
      submitted_for_review_at, reviewed_by, reviewed_at, review_status, rejection_reason,
      estimated_hours, actual_hours, tags, attachments_count, comments_count, created_at, updated_at
    )
    SELECT
      id, title, description, assignee_id, created_by, priority, deadline, start_date, completed_at,
      status, related_entity_type, related_entity_id, deal_id, project_id, project_stage_id,
      submitted_for_review_at, reviewed_by, reviewed_at, review_status, rejection_reason,
      estimated_hours, actual_hours, tags, attachments_count, comments_count, created_at, updated_at
    FROM tasks;
  `);

  // Step 3: Удаляем старую таблицу
  console.log('3. Удаление старой таблицы...');
  db.exec('DROP TABLE tasks;');

  // Step 4: Переименовываем новую таблицу
  console.log('4. Переименование таблицы...');
  db.exec('ALTER TABLE tasks_new RENAME TO tasks;');

  console.log('\n✅ Миграция завершена успешно!');

  // Проверяем результат
  const tasks = db.prepare('SELECT id, title, deadline, created_at FROM tasks').all();
  console.log(`\n📊 Всего задач: ${tasks.length}`);
  tasks.forEach(task => {
    console.log(`  - ${task.title}: deadline = ${task.deadline}`);
  });

} catch (error) {
  console.error('\n❌ Ошибка:', error);
  process.exit(1);
} finally {
  db.close();
}
