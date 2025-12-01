import { db } from './server/db.js';
import { user_permissions, users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

console.log('🔍 Проверка прав доступа пользователей...\n');

// Получаем всех пользователей
const allUsers = await db.select().from(users);
console.log(`Найдено пользователей: ${allUsers.length}\n`);

for (const user of allUsers) {
  console.log(`👤 Пользователь: ${user.username} (${user.full_name || 'без имени'})`);

  // Получаем права пользователя
  const permissions = await db.select().from(user_permissions).where(eq(user_permissions.user_id, user.id));

  if (permissions.length === 0) {
    console.log('   ⚠️  НЕТ ПРАВ ДОСТУПА!');
  } else {
    console.log(`   Права (${permissions.length}):`);
    permissions.forEach(perm => {
      console.log(`   - ${perm.module_name}: ${perm.can_read ? '📖' : ''}${perm.can_create ? '➕' : ''}${perm.can_update ? '✏️' : ''}${perm.can_delete ? '🗑️' : ''}`);
    });
  }
  console.log('');
}

process.exit(0);
