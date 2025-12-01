import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('🔍 Проверка системы проектов...\n');

// Получаем существующие проекты
const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 5').all();
console.log(`📁 Найдено проектов: ${projects.length}`);

projects.forEach((project, index) => {
  console.log(`\n${index + 1}. Проект: ${project.name || 'Без названия'}`);
  console.log(`   Номер: ${project.project_number || project.number || 'Не указан'}`);
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
      const typeInfo = stage.type_name ? ` [Тип: ${stage.type_name}]` : '';
      console.log(`      - ${stage.icon || '•'} ${stage.name}${typeInfo} (${stage.status})`);
    });
  } else {
    console.log(`   Этапы: Нет этапов`);
  }
});

// Проверяем наличие всех необходимых колонок
console.log('\n📊 Проверка структуры таблиц:');

const checkColumns = (tableName, requiredColumns) => {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const existingCols = cols.map(c => c.name);

  console.log(`\n   Таблица ${tableName}:`);
  requiredColumns.forEach(col => {
    if (existingCols.includes(col)) {
      console.log(`   ✅ ${col}`);
    } else {
      console.log(`   ❌ ${col} - отсутствует`);
    }
  });
};

checkColumns('project_stages', ['stage_type_id', 'type_data']);
checkColumns('project_items', ['image_url']);
checkColumns('tasks', ['project_id', 'deal_id']);
checkColumns('deal_documents', ['contract_number', 'contract_date', 'customer_name']);

db.close();
console.log('\n✅ Проверка завершена!');