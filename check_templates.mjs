import fetch from 'node-fetch';

async function checkTemplates() {
  try {
    // Get all templates
    const templatesRes = await fetch('http://localhost:7000/api/templates');
    const templates = await templatesRes.json();

    console.log('=== ПРОВЕРКА ШАБЛОНОВ ===\n');

    for (const template of templates) {
      console.log(`\n📋 Шаблон: ${template.name}`);
      console.log(`   ID: ${template.id}`);
      console.log(`   Активен: ${template.is_active ? 'Да' : 'Нет'}`);

      // Get stages for this template
      const stagesRes = await fetch(`http://localhost:7000/api/templates/${template.id}/stages`);
      const stages = await stagesRes.json();

      if (stages.length === 0) {
        console.log('   ⚠️  Этапов нет');
        continue;
      }

      console.log(`   Этапы (${stages.length}):`);
      stages.forEach((stage, idx) => {
        console.log(`     ${idx + 1}. ${stage.name}`);
        console.log(`        Order: ${stage.order}`);
        console.log(`        stage_type_id: ${stage.stage_type_id || '❌ НЕТ!'}`);
      });
    }

  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

checkTemplates();
