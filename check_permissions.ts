import { db } from './server/db';
import { role_permissions, users, roles } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkPermissions() {
  console.log('🔍 Проверка прав доступа пользователей...\n');

  // Получаем всех пользователей
  const allUsers = await db.select().from(users);
  console.log(`Найдено пользователей: ${allUsers.length}\n`);

  // Получаем все роли
  const allRoles = await db.select().from(roles);
  console.log(`Всего ролей: ${allRoles.length}\n`);

  for (const user of allUsers) {
    console.log(`👤 Пользователь: ${user.username} (${user.full_name || 'без имени'})`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role ID: ${user.role_id || 'НЕ НАЗНАЧЕНА'}`);

    if (!user.role_id) {
      console.log('   ⚠️  РОЛЬ НЕ НАЗНАЧЕНА!');
      console.log('');
      continue;
    }

    // Находим роль
    const userRole = allRoles.find(r => r.id === user.role_id);
    if (userRole) {
      console.log(`   Роль: ${userRole.name}`);
    }

    // Получаем права роли
    const permissions = await db.select().from(role_permissions).where(eq(role_permissions.role_id, user.role_id));

    if (permissions.length === 0) {
      console.log('   ⚠️  У РОЛИ НЕТ ПРАВ ДОСТУПА!');
    } else {
      console.log(`   Права (${permissions.length}):`);
      permissions.forEach(perm => {
        const rights = [];
        if (perm.can_read) rights.push('📖');
        if (perm.can_create) rights.push('➕');
        if (perm.can_update) rights.push('✏️');
        if (perm.can_delete) rights.push('🗑️');
        console.log(`   - ${perm.module_name}: ${rights.join(' ')}`);
      });
    }
    console.log('');
  }

  // Показываем все права всех ролей
  console.log('\n📋 ВСЕ РОЛИ И ИХ ПРАВА:\n');
  for (const role of allRoles) {
    console.log(`🎭 Роль: ${role.name} (${role.id})`);
    const permissions = await db.select().from(role_permissions).where(eq(role_permissions.role_id, role.id));

    if (permissions.length === 0) {
      console.log('   ⚠️  Нет прав');
    } else {
      permissions.forEach(perm => {
        const rights = [];
        if (perm.can_read) rights.push('📖');
        if (perm.can_create) rights.push('➕');
        if (perm.can_update) rights.push('✏️');
        if (perm.can_delete) rights.push('🗑️');
        console.log(`   - ${perm.module_name}: ${rights.join(' ')}`);
      });
    }
    console.log('');
  }
}

checkPermissions().catch(console.error);
