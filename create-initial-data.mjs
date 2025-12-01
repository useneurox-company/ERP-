import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('📂 Database:', dbPath);
console.log('🌱 Creating initial data...\n');

try {
  // 1. Create roles
  console.log('Creating roles...');
  const adminRoleId = nanoid();
  const managerRoleId = nanoid();

  db.prepare(`
    INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminRoleId, 'Администратор', 'Полный доступ ко всем модулям', 1, Date.now(), Date.now());

  db.prepare(`
    INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(managerRoleId, 'Менеджер', 'Доступ к продажам и проектам', 0, Date.now(), Date.now());

  console.log('✅ Created 2 roles');

  // 2. Create role permissions for admin
  console.log('Creating role permissions...');
  const modules = ['sales', 'projects', 'production', 'warehouse', 'finance', 'installation'];

  for (const module of modules) {
    db.prepare(`
      INSERT INTO role_permissions (id, role_id, module, can_view, can_create, can_edit, can_delete, view_all, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nanoid(), adminRoleId, module, 1, 1, 1, 1, 1, Date.now(), Date.now());
  }

  console.log('✅ Created permissions for admin role');

  // 3. Create users
  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('admin123', 10);
  const adminUserId = 'PzBCVrbz9DhOSj2yzGDq-';

  db.prepare(`
    INSERT INTO users (id, username, password, email, full_name, role_id, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(adminUserId, 'admin', passwordHash, 'admin@emerald-erp.ru', 'Береговой Максим', adminRoleId, 1, Date.now(), Date.now());

  console.log('✅ Created admin user (admin / admin123)');

  // 4. Create sales pipeline
  console.log('Creating sales pipeline...');
  const pipelineId = nanoid();

  db.prepare(`
    INSERT INTO sales_pipelines (id, name, description, is_default, "order", created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(pipelineId, 'Основная воронка', 'Основная воронка продаж', 1, 0, Date.now(), Date.now());

  console.log('✅ Created sales pipeline');

  // 5. Create deal stages
  console.log('Creating deal stages...');
  const stages = [
    { key: 'new', name: 'Новая заявка', color: '#6366f1', order: 0 },
    { key: 'contact', name: 'Первый контакт', color: '#8b5cf6', order: 1 },
    { key: 'qualification', name: 'Квалификация', color: '#a855f7', order: 2 },
    { key: 'proposal', name: 'Коммерческое предложение', color: '#d946ef', order: 3 },
    { key: 'negotiation', name: 'Переговоры', color: '#ec4899', order: 4 },
    { key: 'won', name: 'Сделка выиграна', color: '#22c55e', order: 5 },
    { key: 'lost', name: 'Сделка проиграна', color: '#ef4444', order: 6 }
  ];

  for (const stage of stages) {
    db.prepare(`
      INSERT INTO deal_stages (id, pipeline_id, name, key, color, "order", created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nanoid(), pipelineId, stage.name, stage.key, stage.color, stage.order, Date.now());
  }

  console.log('✅ Created 7 deal stages');

  // 6. Create sample deals
  console.log('Creating sample deals...');
  const sampleDeals = [
    {
      client_name: 'ООО "Альфа"',
      company: 'ООО "Альфа"',
      contact_phone: '+7 (495) 123-45-67',
      contact_email: 'info@alpha.ru',
      amount: 500000,
      stage: 'new'
    },
    {
      client_name: 'ИП Иванов',
      company: 'ИП Иванов',
      contact_phone: '+7 (495) 234-56-78',
      contact_email: 'ivanov@mail.ru',
      amount: 300000,
      stage: 'contact'
    },
    {
      client_name: 'ООО "Бета"',
      company: 'ООО "Бета"',
      contact_phone: '+7 (495) 345-67-89',
      contact_email: 'beta@company.ru',
      amount: 750000,
      stage: 'proposal'
    }
  ];

  for (const deal of sampleDeals) {
    db.prepare(`
      INSERT INTO deals (id, pipeline_id, client_name, company, contact_phone, contact_email, amount, stage, manager_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nanoid(),
      pipelineId,
      deal.client_name,
      deal.company,
      deal.contact_phone,
      deal.contact_email,
      deal.amount,
      deal.stage,
      adminUserId,
      Date.now(),
      Date.now()
    );
  }

  console.log('✅ Created 3 sample deals');

  console.log('\n✨ Initial data created successfully!');
  console.log('\n📋 Login credentials:');
  console.log('   Username: admin');
  console.log('   Password: admin123');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
