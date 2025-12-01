import { db } from './db';
import { stage_types, process_templates, template_stages } from '@shared/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

async function seedStageTypes() {
  console.log('🌱 Seeding stage types and templates...');

  // Standard stage types
  const stageTypesData = [
    {
      code: 'measurement',
      name: 'Замер',
      icon: '📏',
      description: 'Этап замера помещения',
      is_active: 1, // Use 1/0 instead of true/false for SQLite compatibility
    },
    {
      code: 'technical_specification',
      name: 'Техническое задание',
      icon: '📋',
      description: 'Формирование технического задания с допами и финальным КП',
      is_active: 1,
    },
    {
      code: 'constructor_documentation',
      name: 'Разработка КД',
      icon: '📐',
      description: 'Разработка конструкторской документации',
      is_active: 1,
    },
    // Новые индивидуальные этапы
    {
      code: 'approval',
      name: 'Согласование',
      icon: '✅',
      description: 'Согласование проекта с клиентом',
      is_active: 1,
    },
    {
      code: 'procurement',
      name: 'Снабжение',
      icon: '📦',
      description: 'Закупка материалов и комплектующих',
      is_active: 1,
    },
    {
      code: 'production',
      name: 'Производство',
      icon: '🏭',
      description: 'Изготовление мебели на производстве',
      is_active: 1,
    },
    {
      code: 'installation',
      name: 'Монтаж',
      icon: '🔨',
      description: 'Установка и монтаж мебели на объекте',
      is_active: 1,
    },
    // Деактивированный этап (для обратной совместимости)
    {
      code: 'delivery',
      name: 'Доставка',
      icon: '🚚',
      description: 'Доставка продукции на объект (деактивирован)',
      is_active: 0,
    },
  ];

  // Insert stage types
  for (const stageType of stageTypesData) {
    const existing = await db
      .select()
      .from(stage_types)
      .where(eq(stage_types.code, stageType.code))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(stage_types).values({
        id: nanoid(),
        ...stageType,
      });
      console.log(`✅ Stage type "${stageType.name}" (${stageType.code}) created`);
    } else {
      console.log(`✅ Stage type "${stageType.name}" (${stageType.code}) already exists`);
    }
  }

  // Get stage type IDs
  const measurementType = await db
    .select()
    .from(stage_types)
    .where(eq(stage_types.code, 'measurement'))
    .limit(1);

  const technicalSpecType = await db
    .select()
    .from(stage_types)
    .where(eq(stage_types.code, 'technical_specification'))
    .limit(1);

  const constructorDocType = await db
    .select()
    .from(stage_types)
    .where(eq(stage_types.code, 'constructor_documentation'))
    .limit(1);

  const approvalType = await db
    .select()
    .from(stage_types)
    .where(eq(stage_types.code, 'approval'))
    .limit(1);

  const procurementType = await db
    .select()
    .from(stage_types)
    .where(eq(stage_types.code, 'procurement'))
    .limit(1);

  const productionType = await db
    .select()
    .from(stage_types)
    .where(eq(stage_types.code, 'production'))
    .limit(1);

  const installationType = await db
    .select()
    .from(stage_types)
    .where(eq(stage_types.code, 'installation'))
    .limit(1);

  // Create default templates
  const templatesData = [
    {
      name: 'Замер квартиры',
      description: 'Стандартный шаблон для замера квартиры',
      is_active: 1, // Use 1/0 instead of true/false for SQLite compatibility
      stages: [
        {
          name: 'Замер',
          stage_type_id: measurementType[0]?.id,
          order: 1,
        },
      ],
    },
    {
      name: 'Полный цикл (Замер + ТЗ + КД)',
      description: 'Полный цикл: от замера до разработки конструкторской документации',
      is_active: 1,
      stages: [
        {
          name: 'Замер',
          stage_type_id: measurementType[0]?.id,
          order: 1,
        },
        {
          name: 'Техническое задание',
          stage_type_id: technicalSpecType[0]?.id,
          order: 2,
        },
        {
          name: 'Разработка КД',
          stage_type_id: constructorDocType[0]?.id,
          order: 3,
        },
      ],
    },
    {
      name: 'Полный производственный цикл',
      description: 'Полный цикл производства мебели: от замера до монтажа',
      is_active: 1,
      stages: [
        {
          name: 'Замер',
          stage_type_id: measurementType[0]?.id,
          order: 1,
        },
        {
          name: 'Техническое задание',
          stage_type_id: technicalSpecType[0]?.id,
          order: 2,
        },
        {
          name: 'Согласование',
          stage_type_id: approvalType[0]?.id,
          order: 3,
        },
        {
          name: 'Разработка КД',
          stage_type_id: constructorDocType[0]?.id,
          order: 4,
        },
        {
          name: 'Снабжение',
          stage_type_id: procurementType[0]?.id,
          order: 5,
        },
        {
          name: 'Производство',
          stage_type_id: productionType[0]?.id,
          order: 6,
        },
        {
          name: 'Монтаж',
          stage_type_id: installationType[0]?.id,
          order: 7,
        },
      ],
    },
  ];

  for (const template of templatesData) {
    const existing = await db
      .select()
      .from(process_templates)
      .where(eq(process_templates.name, template.name))
      .limit(1);

    let templateId: string;

    if (existing.length === 0) {
      templateId = nanoid();
      await db.insert(process_templates).values({
        id: templateId,
        name: template.name,
        description: template.description,
        is_active: template.is_active ? 1 : 0,
      });
      console.log(`✅ Template "${template.name}" created`);

      // Create template stages
      for (const stage of template.stages) {
        await db.insert(template_stages).values({
          id: nanoid(),
          template_id: templateId,
          name: stage.name,
          stage_type_id: stage.stage_type_id,
          order: stage.order,
        });
        console.log(`   ✅ Stage "${stage.name}" added to template`);
      }
    } else {
      console.log(`✅ Template "${template.name}" already exists`);
    }
  }

  console.log('🎉 Stage types and templates seeding completed!');
}

seedStageTypes().catch(console.error);
