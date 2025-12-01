// Fix the measurement stage in "Столярка" template
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

const response = await fetch(`http://localhost:7000/api/templates/stages/${stageId}`, {
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
const verifyResponse = await fetch(`http://localhost:7000/api/templates/JVf3Qab2bc_aMBKT6cKVx`);
const template = await verifyResponse.json();
console.log('Template stages:', JSON.stringify(template.stages, null, 2));
