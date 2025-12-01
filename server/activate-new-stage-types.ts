import { db } from './db';
import { stage_types } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function activateNewStageTypes() {
  console.log('🔄 Активация новых типов этапов...\n');

  // Типы для активации (которые уже есть, но деактивированы)
  const typesToActivate = ['approval', 'production', 'installation'];

  // Новый тип для создания
  const newType = {
    code: 'procurement',
    name: 'Снабжение',
    icon: '📦',
    description: 'Закупка материалов и комплектующих',
    is_active: 1,
  };

  console.log('✅ АКТИВИРУЕМЫЕ ТИПЫ:');
  typesToActivate.forEach(code => console.log(`   - ${code}`));
  console.log(`\n✨ НОВЫЙ ТИП:\n   - ${newType.code}\n`);

  // Получаем все типы этапов
  const allTypes = await db.select().from(stage_types);
  console.log(`📊 Найдено типов этапов в БД: ${allTypes.length}\n`);

  let activatedCount = 0;

  // Активируем существующие типы
  for (const code of typesToActivate) {
    const type = allTypes.find(t => t.code === code);

    if (type) {
      if (type.is_active === 0) {
        await db.update(stage_types)
          .set({ is_active: 1 })
          .where(eq(stage_types.code, code));

        console.log(`✓ Активирован: ${type.name} (${code})`);
        activatedCount++;
      } else {
        console.log(`⊙ Уже активен: ${type.name} (${code})`);
      }
    } else {
      console.log(`⚠ Не найден: ${code}`);
    }
  }

  // Создаем новый тип procurement, если его нет
  const procurementExists = allTypes.find(t => t.code === newType.code);

  if (!procurementExists) {
    await db.insert(stage_types).values({
      id: nanoid(),
      ...newType,
    });
    console.log(`\n✓ Создан новый тип: ${newType.name} (${newType.code})`);
  } else {
    console.log(`\n⊙ Тип ${newType.name} уже существует`);
    // Если существует, но неактивен - активируем
    if (procurementExists.is_active === 0) {
      await db.update(stage_types)
        .set({ is_active: 1 })
        .where(eq(stage_types.code, newType.code));
      console.log(`✓ Активирован: ${newType.name}`);
      activatedCount++;
    }
  }

  console.log(`\n📈 ИТОГО:`);
  console.log(`   Активировано/создано: ${activatedCount + (procurementExists ? 0 : 1)} типов`);
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

  console.log('🎉 Активация завершена!');
  console.log('💡 Теперь доступны для использования:');
  console.log('   1. Замер 📏');
  console.log('   2. Техническое задание 📋');
  console.log('   3. Разработка КД 📐');
  console.log('   4. Согласование ✅');
  console.log('   5. Снабжение 📦');
  console.log('   6. Производство 🏭');
  console.log('   7. Монтаж 🔨');
}

activateNewStageTypes().catch(console.error);
