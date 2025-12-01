import { db } from '../db';
import { roles, role_permissions, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const MODULES = [
  'deals',          // Сделки
  'projects',       // Проекты
  'tasks',          // Задачи
  'warehouse',      // Склад
  'finance',        // Финансы
  'production',     // Производство
  'installations',  // Монтаж
  'documents',      // Документы
  'users',          // Пользователи
  'settings',       // Настройки
];

const DEFAULT_ROLES = [
  {
    name: 'Администратор',
    description: 'Полный доступ ко всем модулям системы',
    is_system: 1,
    permissions: {
      deals: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      projects: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      tasks: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      warehouse: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      finance: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      production: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      installations: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      documents: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      users: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      settings: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
    },
  },
  {
    name: 'Менеджер продаж',
    description: 'Доступ к сделкам и проектам',
    is_system: 0,
    permissions: {
      deals: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 },
      projects: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      tasks: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 },
      warehouse: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      finance: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      production: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      installations: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      documents: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 },
      users: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      settings: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
    },
  },
  {
    name: 'Менеджер проектов',
    description: 'Управление проектами и задачами',
    is_system: 0,
    permissions: {
      deals: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      projects: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 },
      tasks: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      warehouse: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 1 },
      finance: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      production: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 1 },
      installations: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 1 },
      documents: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 },
      users: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      settings: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
    },
  },
  {
    name: 'Сметчик',
    description: 'Создание смет и работа с документами',
    is_system: 0,
    permissions: {
      deals: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 1 },
      projects: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 1 },
      tasks: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      warehouse: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      finance: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      production: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      installations: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      documents: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 1 },
      users: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      settings: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
    },
  },
  {
    name: 'Конструктор',
    description: 'Разработка конструкций и чертежей',
    is_system: 0,
    permissions: {
      deals: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      projects: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 1 },
      tasks: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      warehouse: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      finance: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      production: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 1 },
      installations: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      documents: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 1 },
      users: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      settings: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
    },
  },
  {
    name: 'Финансист',
    description: 'Управление финансами',
    is_system: 0,
    permissions: {
      deals: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      projects: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      tasks: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      warehouse: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      finance: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      production: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      installations: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      documents: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 1 },
      users: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      settings: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
    },
  },
  {
    name: 'Кладовщик',
    description: 'Управление складом',
    is_system: 0,
    permissions: {
      deals: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      projects: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      tasks: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      warehouse: { can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      finance: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      production: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      installations: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      documents: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      users: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      settings: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
    },
  },
  {
    name: 'Замерщик',
    description: 'Проведение замеров',
    is_system: 0,
    permissions: {
      deals: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      projects: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      tasks: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      warehouse: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      finance: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      production: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      installations: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      documents: { can_view: 1, can_create: 1, can_edit: 0, can_delete: 0, view_all: 0 },
      users: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      settings: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
    },
  },
  {
    name: 'Монтажник',
    description: 'Выполнение монтажных работ',
    is_system: 0,
    permissions: {
      deals: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      projects: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      tasks: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      warehouse: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      finance: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      production: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      installations: { can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      documents: { can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      users: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      settings: { can_view: 0, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
    },
  },
];

export async function migrateRolesAndPermissions() {
  console.log('🔄 Starting roles and permissions migration...');

  try {
    // Create tables if they don't exist
    console.log('📋 Creating tables...');

    // Import better-sqlite3 directly
    const Database = (await import('better-sqlite3')).default;
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const dbPath = join(__dirname, '../../.local/emerald_erp.db');
    const sqlite = new Database(dbPath);

    // Create roles table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_system INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create role_permissions table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id TEXT PRIMARY KEY,
        role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        can_view INTEGER DEFAULT 0 NOT NULL,
        can_create INTEGER DEFAULT 0 NOT NULL,
        can_edit INTEGER DEFAULT 0 NOT NULL,
        can_delete INTEGER DEFAULT 0 NOT NULL,
        view_all INTEGER DEFAULT 0 NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Add new columns to users table if they don't exist
    try {
      sqlite.exec('ALTER TABLE users ADD COLUMN role_id TEXT REFERENCES roles(id);');
    } catch (e: any) {
      if (!e.message.includes('duplicate column name')) throw e;
    }

    try {
      sqlite.exec('ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1 NOT NULL;');
    } catch (e: any) {
      if (!e.message.includes('duplicate column name')) throw e;
    }

    try {
      sqlite.exec('ALTER TABLE users ADD COLUMN updated_at INTEGER;');
    } catch (e: any) {
      if (!e.message.includes('duplicate column name')) throw e;
    }

    sqlite.close();

    console.log('✅ Tables created successfully!');

    // Создаём роли
    console.log('📝 Creating default roles...');
    for (const roleData of DEFAULT_ROLES) {
      const { permissions, ...roleInfo } = roleData;

      // Проверяем, существует ли роль
      const existingRole = await db.select().from(roles).where(eq(roles.name, roleInfo.name)).limit(1);

      let roleId: string;
      if (existingRole.length > 0) {
        console.log(`  ℹ️  Role "${roleInfo.name}" already exists, skipping...`);
        roleId = existingRole[0].id;
      } else {
        const [newRole] = await db.insert(roles).values(roleInfo).returning();
        roleId = newRole.id;
        console.log(`  ✅ Created role: ${roleInfo.name}`);
      }

      // Создаём права для каждого модуля
      for (const [module, perms] of Object.entries(permissions)) {
        const existingPerm = await db.select()
          .from(role_permissions)
          .where(eq(role_permissions.role_id, roleId))
          .where(eq(role_permissions.module, module))
          .limit(1);

        if (existingPerm.length === 0) {
          await db.insert(role_permissions).values({
            role_id: roleId,
            module,
            ...perms,
          });
        }
      }
    }

    // Обновляем существующих пользователей - делаем их администраторами
    console.log('👥 Updating existing users...');
    const adminRole = await db.select().from(roles).where(eq(roles.name, 'Администратор')).limit(1);
    if (adminRole.length > 0) {
      const existingUsers = await db.select().from(users);
      for (const user of existingUsers) {
        if (!user.role_id) {
          await db.update(users)
            .set({ role_id: adminRole[0].id })
            .where(eq(users.id, user.id));
          console.log(`  ✅ Updated user ${user.username} to Administrator role`);
        }
      }
    }

    console.log('✅ Roles and permissions migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Export the migration function for use in run-migration.ts
