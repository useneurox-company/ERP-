# Инструкции для деплоя через веб-консоль Timeweb

## Шаг 1: Откройте веб-консоль на Timeweb

Зайдите на панель Timeweb и откройте веб-консоль для вашего сервера.

## Шаг 2: Переименуйте ecosystem.config.js

```bash
cd /var/www/emerald-erp
mv ecosystem.config.js ecosystem.config.cjs 2>/dev/null || true
```

## Шаг 3: Создайте Node.js скрипт для создания таблиц

Выполните следующую команду (весь блок целиком):

```bash
cat > /tmp/create_tables.mjs << 'EOFSCRIPT'
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  database: 'emerald_erp',
  user: 'emerald_user',
  password: 'EmeraldSecure2025!',
  port: 5432
});

const sql = \`
DROP TABLE IF EXISTS stock_notifications CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS task_checklist_items CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS template_stage_attachments CASCADE;
DROP TABLE IF EXISTS template_dependencies CASCADE;
DROP TABLE IF EXISTS template_stages CASCADE;
DROP TABLE IF EXISTS process_templates CASCADE;
DROP TABLE IF EXISTS stage_types CASCADE;
DROP TABLE IF EXISTS deal_custom_fields CASCADE;
DROP TABLE IF EXISTS custom_field_definitions CASCADE;
DROP TABLE IF EXISTS material_prices CASCADE;
DROP TABLE IF EXISTS ai_corrections CASCADE;
DROP TABLE IF EXISTS ai_chat_messages CASCADE;
DROP TABLE IF EXISTS company_settings CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS installations CASCADE;
DROP TABLE IF EXISTS financial_transactions CASCADE;
DROP TABLE IF EXISTS shipment_items CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS warehouse_reservations CASCADE;
DROP TABLE IF EXISTS warehouse_transactions CASCADE;
DROP TABLE IF EXISTS warehouse_items CASCADE;
DROP TABLE IF EXISTS production_stages CASCADE;
DROP TABLE IF EXISTS production_tasks CASCADE;
DROP TABLE IF EXISTS project_messages CASCADE;
DROP TABLE IF EXISTS stage_media_comments CASCADE;
DROP TABLE IF EXISTS stage_documents CASCADE;
DROP TABLE IF EXISTS stage_messages CASCADE;
DROP TABLE IF EXISTS stage_dependencies CASCADE;
DROP TABLE IF EXISTS project_stages CASCADE;
DROP TABLE IF EXISTS project_items CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS deal_attachments CASCADE;
DROP TABLE IF EXISTS deal_documents CASCADE;
DROP TABLE IF EXISTS deal_messages CASCADE;
DROP TABLE IF EXISTS deal_contacts CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS deal_stages CASCADE;
DROP TABLE IF EXISTS sales_pipelines CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT FALSE NOT NULL,
  can_create BOOLEAN DEFAULT FALSE NOT NULL,
  can_edit BOOLEAN DEFAULT FALSE NOT NULL,
  can_delete BOOLEAN DEFAULT FALSE NOT NULL,
  view_all BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT,
  full_name TEXT,
  role_id TEXT REFERENCES roles(id),
  phone TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE sales_pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE deal_stages (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL REFERENCES sales_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE deals (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT REFERENCES sales_pipelines(id),
  client_name TEXT NOT NULL,
  company TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  order_number TEXT UNIQUE,
  amount REAL,
  stage TEXT NOT NULL DEFAULT 'new',
  deadline TIMESTAMP,
  manager_id TEXT REFERENCES users(id),
  production_days_count INTEGER,
  tags TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE deal_contacts (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position TEXT,
  phone TEXT,
  email TEXT,
  is_primary BOOLEAN DEFAULT FALSE NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE deal_messages (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE deal_documents (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  file_url TEXT NOT NULL,
  data TEXT,
  total_amount REAL,
  is_signed BOOLEAN DEFAULT FALSE,
  parent_id TEXT REFERENCES deal_documents(id) ON DELETE CASCADE,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE deal_attachments (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  document_id TEXT REFERENCES deal_documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  deal_id TEXT REFERENCES deals(id),
  invoice_id TEXT REFERENCES deal_documents(id),
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  duration_days INTEGER,
  started_at TIMESTAMP,
  manager_id TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE project_items (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  article TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL,
  source_document_id TEXT REFERENCES deal_documents(id),
  "order" INTEGER NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE stage_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE process_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE template_stages (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES process_templates(id) ON DELETE CASCADE,
  stage_type_id TEXT REFERENCES stage_types(id),
  name TEXT NOT NULL,
  description TEXT,
  duration_days INTEGER,
  assignee_id TEXT REFERENCES users(id),
  cost REAL,
  "order" INTEGER NOT NULL,
  template_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE project_stages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  item_id TEXT REFERENCES project_items(id),
  stage_type_id TEXT REFERENCES stage_types(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  assignee_id TEXT REFERENCES users(id),
  duration_days INTEGER,
  planned_start_date TIMESTAMP,
  planned_end_date TIMESTAMP,
  actual_start_date TIMESTAMP,
  actual_end_date TIMESTAMP,
  cost REAL,
  description TEXT,
  type_data TEXT,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE stage_dependencies (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  depends_on_stage_id TEXT NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE stage_messages (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE stage_documents (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  thumbnail_url TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE stage_media_comments (
  id TEXT PRIMARY KEY,
  stage_id TEXT NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES stage_documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE project_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE production_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  item_name TEXT NOT NULL,
  worker_id TEXT REFERENCES users(id),
  payment REAL,
  deadline TIMESTAMP,
  progress INTEGER DEFAULT 0,
  qr_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE production_stages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES production_tasks(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE warehouse_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  reserved_quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  price REAL DEFAULT 0,
  location TEXT,
  category TEXT NOT NULL,
  supplier TEXT,
  description TEXT,
  min_stock REAL DEFAULT 0,
  track_min_stock BOOLEAN DEFAULT FALSE NOT NULL,
  status TEXT NOT NULL DEFAULT 'normal',
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  project_name TEXT,
  package_details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE warehouse_transactions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES warehouse_items(id),
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE warehouse_reservations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quantity REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reserved_by TEXT REFERENCES users(id),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  released_at TIMESTAMP
);

CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  shipment_number TEXT NOT NULL UNIQUE,
  project_name TEXT NOT NULL,
  delivery_address TEXT,
  warehouse_keeper TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  confirmed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE shipment_items (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES warehouse_items(id),
  item_name TEXT NOT NULL,
  item_sku TEXT,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  is_package BOOLEAN DEFAULT FALSE,
  package_details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE financial_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  project_id TEXT REFERENCES projects(id),
  description TEXT,
  date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  client_name TEXT NOT NULL,
  address TEXT NOT NULL,
  installer_id TEXT REFERENCES users(id),
  phone TEXT,
  date TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'scheduled',
  payment REAL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT REFERENCES users(id),
  created_by TEXT REFERENCES users(id),
  priority TEXT NOT NULL DEFAULT 'normal',
  deadline TIMESTAMP,
  start_date TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'new',
  related_entity_type TEXT,
  related_entity_id TEXT,
  estimated_hours REAL,
  actual_hours REAL,
  tags TEXT,
  attachments_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id),
  project_stage_id TEXT REFERENCES project_stages(id) ON DELETE CASCADE,
  template_stage_id TEXT REFERENCES template_stages(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  size INTEGER,
  uploaded_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE company_settings (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  inn TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE ai_chat_messages (
  id TEXT PRIMARY KEY,
  deal_id TEXT REFERENCES deals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE ai_corrections (
  id TEXT PRIMARY KEY,
  deal_id TEXT REFERENCES deals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  original_data TEXT NOT NULL,
  corrected_data TEXT NOT NULL,
  correction_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE material_prices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  price REAL NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE custom_field_definitions (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT REFERENCES sales_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  options TEXT,
  is_required BOOLEAN DEFAULT FALSE NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE deal_custom_fields (
  id TEXT PRIMARY KEY,
  deal_id TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  field_definition_id TEXT NOT NULL REFERENCES custom_field_definitions(id),
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE template_dependencies (
  id TEXT PRIMARY KEY,
  template_stage_id TEXT NOT NULL REFERENCES template_stages(id) ON DELETE CASCADE,
  depends_on_template_stage_id TEXT NOT NULL REFERENCES template_stages(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE template_stage_attachments (
  id TEXT PRIMARY KEY,
  template_stage_id TEXT NOT NULL REFERENCES template_stages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE task_checklist_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE stock_notifications (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  status TEXT NOT NULL,
  quantity REAL NOT NULL,
  min_stock REAL NOT NULL,
  user_id TEXT REFERENCES users(id),
  read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_deal_stages_pipeline_id ON deal_stages(pipeline_id);
CREATE INDEX idx_deals_pipeline_id ON deals(pipeline_id);
CREATE INDEX idx_deals_manager_id ON deals(manager_id);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deal_contacts_deal_id ON deal_contacts(deal_id);
CREATE INDEX idx_deal_messages_deal_id ON deal_messages(deal_id);
CREATE INDEX idx_deal_documents_deal_id ON deal_documents(deal_id);
CREATE INDEX idx_deal_attachments_deal_id ON deal_attachments(deal_id);
CREATE INDEX idx_projects_deal_id ON projects(deal_id);
CREATE INDEX idx_projects_manager_id ON projects(manager_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_items_project_id ON project_items(project_id);
CREATE INDEX idx_project_stages_project_id ON project_stages(project_id);
CREATE INDEX idx_project_stages_assignee_id ON project_stages(assignee_id);
CREATE INDEX idx_warehouse_items_category ON warehouse_items(category);
CREATE INDEX idx_warehouse_items_project_id ON warehouse_items(project_id);
CREATE INDEX idx_warehouse_transactions_item_id ON warehouse_transactions(item_id);
CREATE INDEX idx_warehouse_reservations_item_id ON warehouse_reservations(item_id);
CREATE INDEX idx_warehouse_reservations_project_id ON warehouse_reservations(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
\`;

async function createTables() {
  try {
    console.log('🚀 Creating tables...');
    await pool.query(sql);
    console.log('✅ All tables created!');

    const result = await pool.query(\`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name;
    \`);

    console.log(\`✅ Created \${result.rows.length} tables:\`);
    result.rows.forEach(row => console.log(\`  - \${row.table_name}\`));

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

createTables();
EOFSCRIPT
```

## Шаг 4: Выполните скрипт создания таблиц

```bash
cd /var/www/emerald-erp
node /tmp/create_tables.mjs
```

Вы должны увидеть сообщение "✅ Created 45 tables" с списком всех созданных таблиц.

## Шаг 5: Запустите seed скрипт для создания начальных данных

```bash
cd /var/www/emerald-erp
node --import tsx server/seed.ts
```

## Шаг 6: Перезапустите приложение через PM2

```bash
cd /var/www/emerald-erp
pm2 delete all
pm2 start ecosystem.config.cjs
pm2 save
pm2 logs --lines 30
```

## Шаг 7: Проверьте работу приложения

Откройте в браузере: http://147.45.146.149

Войдите с учетными данными:
- Логин: **Admin**
- Пароль: **Bereg2025**

## Устранение неполадок

Если что-то не работает, проверьте:

```bash
# Статус PM2
pm2 status

# Логи приложения
pm2 logs --lines 50

# Проверить таблицы в БД
psql -U emerald_user -d emerald_erp -c "\dt"

# Проверить пользователя Admin
psql -U emerald_user -d emerald_erp -c "SELECT id, username, full_name, email FROM users WHERE username='Admin';"
```
