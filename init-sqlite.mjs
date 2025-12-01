import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const localDir = join(__dirname, '.local');
if (!existsSync(localDir)) {
  mkdirSync(localDir, { recursive: true });
}

const dbPath = join(localDir, 'emerald_erp.db');
console.log(`Инициализация базы данных: ${dbPath}\n`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Создаем все таблицы
db.exec(`
  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,
    department TEXT,
    position TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Deals
  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE,
    client_name TEXT NOT NULL,
    client_contact TEXT,
    project_type TEXT NOT NULL,
    description TEXT,
    estimated_value REAL,
    status TEXT NOT NULL,
    assigned_to TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Deal Stages
  CREATE TABLE IF NOT EXISTS deal_stages (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    notes TEXT,
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
  );

  -- Projects
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    project_number TEXT UNIQUE,
    name TEXT NOT NULL,
    deal_id TEXT,
    client_name TEXT NOT NULL,
    client_contact TEXT,
    description TEXT,
    status TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    start_date TEXT,
    end_date TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deal_id) REFERENCES deals(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Project Stages
  CREATE TABLE IF NOT EXISTS project_stages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    template_stage_id TEXT,
    stage_number INTEGER NOT NULL,
    stage_type TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_to TEXT,
    started_at TEXT,
    completed_at TEXT,
    notes TEXT,
    data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );

  -- Process Templates
  CREATE TABLE IF NOT EXISTS process_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Template Stages
  CREATE TABLE IF NOT EXISTS template_stages (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    stage_number INTEGER NOT NULL,
    stage_type TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    description TEXT,
    default_assignee TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES process_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (default_assignee) REFERENCES users(id)
  );

  -- Stage Types
  CREATE TABLE IF NOT EXISTS stage_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT,
    icon TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Documents
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    stage_id TEXT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    file_type TEXT,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    is_signed INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  -- Project Messages
  CREATE TABLE IF NOT EXISTS project_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- Roles
  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Permissions
  CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    role_id TEXT NOT NULL,
    module TEXT NOT NULL,
    can_view INTEGER DEFAULT 0,
    can_create INTEGER DEFAULT 0,
    can_edit INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  );

  -- Notifications
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Warehouse Items
  CREATE TABLE IF NOT EXISTS warehouse_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT NOT NULL,
    quantity REAL DEFAULT 0,
    min_quantity REAL,
    location TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Warehouse Transactions
  CREATE TABLE IF NOT EXISTS warehouse_transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    project_id TEXT,
    transaction_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    notes TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES warehouse_items(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
`);

// Создаем тестового пользователя admin/admin123
const bcrypt = await import('bcrypt');
const passwordHash = await bcrypt.hash('admin123', 10);

db.prepare(`
  INSERT OR IGNORE INTO users (id, username, password_hash, full_name, email, role, is_active)
  VALUES ('admin-user-id', 'admin', ?, 'Администратор', 'admin@emerald-erp.ru', 'admin', 1)
`).run(passwordHash);

console.log('✅ База данных инициализирована');
console.log('✅ Создан пользователь: admin / admin123');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log(`\n📋 Создано таблиц: ${tables.length}`);
tables.forEach(table => console.log(`   - ${table.name}`));

db.close();
