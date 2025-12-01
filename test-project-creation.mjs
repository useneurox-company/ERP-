import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('🔍 Тестирование создания проекта...\n');

// Проверяем структуру таблицы projects
console.log('📊 Структура таблицы projects:');
const projectCols = db.prepare(`PRAGMA table_info(projects)`).all();
console.table(projectCols.map(col => ({
  Колонка: col.name,
  Тип: col.type,
  Обязательная: col.notnull ? 'Да' : 'Нет'
})));

// Проверяем структуру таблицы project_stages
console.log('\n📊 Структура таблицы project_stages:');
const stageCols = db.prepare(`PRAGMA table_info(project_stages)`).all();
console.table(stageCols.map(col => ({
  Колонка: col.name,
  Тип: col.type,
  Обязательная: col.notnull ? 'Да' : 'Нет'
})));

// Проверяем структуру таблицы project_items
console.log('\n📊 Структура таблицы project_items:');
const itemCols = db.prepare(`PRAGMA table_info(project_items)`).all();
console.table(itemCols.map(col => ({
  Колонка: col.name,
  Тип: col.type,
  Обязательная: col.notnull ? 'Да' : 'Нет'
})));

// Получаем существующие проекты
const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 5').all();
console.log(`\n📁 Существующие проекты (последние 5):`);
projects.forEach((project, index) => {
  console.log(`${index + 1}. ${project.name} (${project.number})`);
  console.log(`   Статус: ${project.status}`);
  console.log(`   Создан: ${new Date(project.created_at).toLocaleString('ru-RU')}`);

  // Получаем этапы проекта
  const stages = db.prepare(`
    SELECT ps.*, st.name as type_name, st.icon
    FROM project_stages ps
    LEFT JOIN stage_types st ON ps.stage_type_id = st.id
    WHERE ps.project_id = ?
    ORDER BY ps."order"
  `).all(project.id);

  if (stages.length > 0) {
    console.log(`   Этапы (${stages.length}):`);
    stages.forEach(stage => {
      console.log(`      - ${stage.icon || ''} ${stage.name} (${stage.status})`);
    });
  }
});

// Проверяем связь со сделками
console.log('\n🔗 Проверка связей проектов со сделками:');
const projectsWithDeals = db.prepare(`
  SELECT p.*, d.title as deal_title
  FROM projects p
  LEFT JOIN deals d ON p.deal_id = d.id
  LIMIT 5
`).all();

projectsWithDeals.forEach((project, index) => {
  console.log(`${index + 1}. Проект: ${project.name}`);
  console.log(`   Сделка: ${project.deal_title || 'Не привязан к сделке'}`);
});

db.close();
console.log('\n✅ Тестирование завершено!');