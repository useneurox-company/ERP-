import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('📂 Database:', dbPath);
console.log('🌱 Creating roles and permissions...\n');

try {
  // Определяем роли с описаниями
  const rolesToCreate = [
    {
      name: 'Замерщик',
      description: 'Специалист по замерам помещений. Доступ только к этапам замера и своим проектам'
    },
    {
      name: 'Руководитель проекта',
      description: 'Полный контроль над проектами, задачами и всеми этапами'
    },
    {
      name: 'Конструктор',
      description: 'Разработка технических заданий и конструкторской документации'
    },
    {
      name: 'Менеджер снабжения',
      description: 'Управление закупками, складом и снабжением проектов'
    },
    {
      name: 'Монтажник',
      description: 'Установка и монтаж мебели на объектах'
    }
  ];

  // 1. Создаём роли
  console.log('1️⃣ Creating roles...');
  const roleIds = {};

  for (const role of rolesToCreate) {
    const existing = db.prepare('SELECT id FROM roles WHERE name = ?').get(role.name);

    if (existing) {
      roleIds[role.name] = existing.id;
      console.log(`   ✓ Role "${role.name}" already exists (${existing.id})`);
    } else {
      const roleId = nanoid();
      db.prepare(`
        INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(roleId, role.name, role.description, 0, Date.now(), Date.now());

      roleIds[role.name] = roleId;
      console.log(`   ✅ Created role "${role.name}" (${roleId})`);
    }
  }

  // 2. Настраиваем права доступа к модулям (role_permissions)
  console.log('\n2️⃣ Configuring module permissions...');

  const permissions = {
    'Замерщик': [
      { module: 'projects', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      { module: 'tasks', can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      { module: 'documents', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 }
    ],
    'Руководитель проекта': [
      { module: 'sales', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      { module: 'projects', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      { module: 'tasks', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      { module: 'documents', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      { module: 'finance', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      { module: 'warehouse', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      { module: 'production', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 }
    ],
    'Конструктор': [
      { module: 'projects', can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      { module: 'tasks', can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      { module: 'documents', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 },
      { module: 'production', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 }
    ],
    'Менеджер снабжения': [
      { module: 'projects', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 1 },
      { module: 'warehouse', can_view: 1, can_create: 1, can_edit: 1, can_delete: 1, view_all: 1 },
      { module: 'tasks', can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      { module: 'finance', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 }
    ],
    'Монтажник': [
      { module: 'projects', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      { module: 'tasks', can_view: 1, can_create: 0, can_edit: 1, can_delete: 0, view_all: 0 },
      { module: 'warehouse', can_view: 1, can_create: 0, can_edit: 0, can_delete: 0, view_all: 0 },
      { module: 'installations', can_view: 1, can_create: 1, can_edit: 1, can_delete: 0, view_all: 0 }
    ]
  };

  for (const [roleName, perms] of Object.entries(permissions)) {
    const roleId = roleIds[roleName];
    console.log(`\n   Configuring "${roleName}":`);

    for (const perm of perms) {
      // Проверяем, существует ли уже право
      const existing = db.prepare(
        'SELECT id FROM role_permissions WHERE role_id = ? AND module = ?'
      ).get(roleId, perm.module);

      if (existing) {
        // Обновляем существующее право
        db.prepare(`
          UPDATE role_permissions
          SET can_view = ?, can_create = ?, can_edit = ?, can_delete = ?, view_all = ?, updated_at = ?
          WHERE id = ?
        `).run(perm.can_view, perm.can_create, perm.can_edit, perm.can_delete, perm.view_all, Date.now(), existing.id);

        console.log(`      ↻ Updated ${perm.module} permissions`);
      } else {
        // Создаём новое право
        db.prepare(`
          INSERT INTO role_permissions (id, role_id, module, can_view, can_create, can_edit, can_delete, view_all, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          nanoid(),
          roleId,
          perm.module,
          perm.can_view,
          perm.can_create,
          perm.can_edit,
          perm.can_delete,
          perm.view_all,
          Date.now(),
          Date.now()
        );

        console.log(`      ✅ Created ${perm.module} permissions`);
      }
    }
  }

  console.log('\n✨ Roles and permissions created successfully!');
  console.log('\n📋 Summary:');
  console.log('   ✓ 5 roles created/updated');
  console.log('   ✓ Module permissions configured');
  console.log('\n💡 You can now manage permissions in Settings → Roles');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
