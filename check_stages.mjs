import fetch from 'node-fetch';

async function checkStages() {
  try {
    // Get all projects
    const projectsRes = await fetch('http://localhost:7000/api/projects');
    const projects = await projectsRes.json();

    console.log('=== ПРОВЕРКА ЭТАПОВ ===\n');

    if (projects.length === 0) {
      console.log('Проектов не найдено');
      return;
    }

    // Get first project
    const project = projects[0];
    console.log(`Проект: ${project.name} (${project.id})\n`);

    // Get stages for this project
    const stagesRes = await fetch(`http://localhost:7000/api/projects/${project.id}/stages`);
    const stages = await stagesRes.json();

    console.log(`Найдено этапов: ${stages.length}\n`);

    stages.forEach((stage, idx) => {
      console.log(`${idx + 1}. ${stage.name}`);
      console.log(`   ID: ${stage.id}`);
      console.log(`   stage_type_id: ${stage.stage_type_id || 'НЕТ!'}`);
      console.log(`   status: ${stage.status}`);
      console.log('');
    });

  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

checkStages();
