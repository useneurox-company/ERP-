// Fix the measurement stage in "Столярка" template for PRODUCTION via public API
const stageId = "qvelUtiveZYA25huArqGV";
const measurementTypeId = "ozbcyzCY6O3wsNTAh1MQE";

const updateData = {
  stage_type_id: measurementTypeId,
  template_data: JSON.stringify({
    measurement_date: null,
    address: null,
    room_measurements: [],
    notes: null
  })
};

const response = await fetch(`http://147.45.146.149/api/templates/stages/${stageId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(updateData)
});

console.log('Status:', response.status);
const result = await response.json();
console.log('Result:', JSON.stringify(result, null, 2));

// Verify the update
console.log('\n=== VERIFYING UPDATE ===');
const verifyResponse = await fetch('http://147.45.146.149/api/templates/JVf3Qab2bc_aMBKT6cKVx');
const template = await verifyResponse.json();
console.log('Template info:');
console.log('  Name:', template.template?.name);
console.log('  Stages count:', template.stages?.length);
if (template.stages && template.stages.length > 0) {
  console.log('\nStage details:');
  template.stages.forEach((stage, idx) => {
    console.log(`  Stage ${idx + 1}:`, stage.name);
    console.log(`    stage_type_id:`, stage.stage_type_id);
    console.log(`    template_data:`, stage.template_data ? 'Установлено' : 'Не установлено');
  });
}
