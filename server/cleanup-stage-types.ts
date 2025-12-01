import { db } from './db';
import { stage_types } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function cleanupStageTypes() {
  console.log('🧹 Очистка типов этапов...\n');

  // Список активных типов (которые нужно оставить)
  const activeTypes = ['measurement', 'technical_specification', 'constructor_documentation'];

  // Список типов для деактивации
  const typesToDeactivate = ['approval', 'design', 'production', 'installation', 'delivery'];

  console.log('✅ АКТИВНЫЕ ТИПЫ (is_active = 1):');
  activeTypes.forEach(code => console.log(`   - ${code}`));
  console.log('');

  console.log('❌ ДЕАКТИВИРУЕМЫЕ ТИПЫ (is_active = 0):');
  typesToDeactivate.forEach(code => console.log(`   - ${code}`));
  console.log('');

  // Получаем все типы этапов
  const allTypes = await db.select().from(stage_types);
  console.log(`📊 Найдено типов этапов в БД: ${allTypes.length}\n`);

  let deactivatedCount = 0;

  // Деактивируем лишние типы
  for (const code of typesToDeactivate) {
    const type = allTypes.find(t => t.code === code);

    if (type) {
      if (type.is_active === 1) {
        await db.update(stage_types)
          .set({ is_active: 0 })
          .where(eq(stage_types.code, code));

        console.log(`✓ Деактивирован: ${type.name} (${code})`);
        deactivatedCount++;
      } else {
        console.log(`⊘ Уже деактивирован: ${type.name} (${code})`);
      }
    } else {
      console.log(`⚠ Не найден: ${code}`);
    }
  }

  // Исправляем иконку для installation
  const installation = allTypes.find(t => t.code === 'installation');
  if (installation && installation.icon !== '🔨') {
    await db.update(stage_types)
      .set({ icon: '🔨' })
      .where(eq(stage_types.code, 'installation'));
    console.log(`\n🔧 → 🔨 Исправлена иконка для "Монтаж"`);
  }

  console.log(`\n📈 ИТОГО:`);
  console.log(`   Деактивировано: ${deactivatedCount} типов`);
  console.log(`   Осталось активных: ${activeTypes.length} типов`);
  console.log('');

  // Проверяем финальное состояние
  const finalTypes = await db.select().from(stage_types);
  const activeCount = finalTypes.filter(t => t.is_active === 1).length;
  const inactiveCount = finalTypes.filter(t => t.is_active === 0).length;

  console.log('✨ ФИНАЛЬНОЕ СОСТОЯНИЕ:');
  console.log(`   Активные: ${activeCount}`);
  console.log(`   Неактивные: ${inactiveCount}`);
  console.log(`   Всего: ${finalTypes.length}`);
  console.log('');

  console.log('🎉 Очистка завершена!');
  console.log('💡 Теперь в селекторе типов этапов будут показываться только 3 активных типа');
}

cleanupStageTypes().catch(console.error);
