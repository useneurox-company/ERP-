import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Connect to SQLite database
const dbPath = join(__dirname, '.local', 'emerald_erp.db');
console.log(`Подключаюсь к: ${dbPath}\n`);

const db = new Database(dbPath);

// Get all users
const users = db.prepare('SELECT id, username, full_name, role_id FROM users').all();
console.log(`👥 Найдено пользователей: ${users.length}\n`);

for (const user of users) {
  console.log(`👤 ${user.username} (${user.full_name || 'без имени'})`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Role ID: ${user.role_id || 'НЕ НАЗНАЧЕНА'}`);

  if (user.role_id) {
    // Get role name
    const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(user.role_id);
    if (role) {
      console.log(`   Роль: ${role.name}`);
    }

    // Get permissions
    const permissions = db.prepare(`
      SELECT module, can_view, can_create, can_edit, can_delete, view_all
      FROM role_permissions
      WHERE role_id = ?
    `).all(user.role_id);

    if (permissions.length > 0) {
      console.log(`   Права (${permissions.length}):`);
      permissions.forEach(perm => {
        const rights = [];
        if (perm.can_view) rights.push('📖');
        if (perm.can_create) rights.push('➕');
        if (perm.can_edit) rights.push('✏️');
        if (perm.can_delete) rights.push('🗑️');
        console.log(`   - ${perm.module}: ${rights.join(' ')}`);
      });
    } else {
      console.log('   ⚠️  У роли НЕТ ПРАВ!');
    }
  }
  console.log('');
}

db.close();
