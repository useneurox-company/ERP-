import fetch from 'node-fetch';
import { nanoid } from 'nanoid';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000/api';
let authHeaders = {};
let testResults = {
  passed: [],
  failed: [],
  fixed: []
};

// Test data storage
let testData = {
  pipeline: null,
  stage: null,
  deal: null,
  project: null,
  projectStage: null,
  projectItem: null,
  warehouse: {
    category: null,
    item: null
  },
  user: null,
  role: null,
  task: null,
  template: null,
  shipment: null
};

async function testEndpoint(method, path, data = null, description = '') {
  const fullPath = path.startsWith('/') ? path : `/${path}`;
  console.log(`🧪 Testing: ${method} ${fullPath}${description ? ` - ${description}` : ''}`);

  try {
    const options = {
      method,
      headers: { ...authHeaders, 'Content-Type': 'application/json' }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${BASE_URL}${fullPath}`, options);
    const responseData = await response.json().catch(() => null);

    if (response.ok) {
      console.log(`✅ PASSED: ${method} ${fullPath}`);
      testResults.passed.push(`${method} ${fullPath}${description ? ` - ${description}` : ''}`);
      return { success: true, data: responseData };
    } else {
      console.log(`❌ FAILED: ${method} ${fullPath} - Status: ${response.status}`);
      if (responseData?.error) console.log(`   Error: ${responseData.error}`);
      testResults.failed.push({
        endpoint: `${method} ${fullPath}${description ? ` - ${description}` : ''}`,
        status: response.status,
        error: responseData?.error
      });
      return { success: false, error: responseData?.error };
    }
  } catch (error) {
    console.log(`❌ ERROR: ${method} ${fullPath} - ${error.message}`);
    testResults.failed.push({
      endpoint: `${method} ${fullPath}${description ? ` - ${description}` : ''}`,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 STARTING FIXED ERP SYSTEM TEST');
  console.log('=' .repeat(50));

  // Phase 1: Authentication
  console.log('\n📦 PHASE 1: AUTHENTICATION');
  console.log('-'.repeat(40));

  const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Admin', password: 'Bereg2025' })
  });

  const loginData = await loginResponse.json();
  if (loginData.user && loginData.user.id) {
    authHeaders['X-User-ID'] = loginData.user.id;
    console.log('✅ Authentication successful');
    testResults.passed.push('Authentication');
  } else {
    console.log('❌ Authentication failed');
    return;
  }

  // Phase 2: User Management
  console.log('\n📦 PHASE 2: USER MANAGEMENT');
  console.log('-'.repeat(40));

  await testEndpoint('GET', '/users', null, 'Get all users');
  await testEndpoint('GET', `/users/${authHeaders['X-User-ID']}`, null, 'Get current user');

  const newUser = await testEndpoint('POST', '/users', {
    username: `testuser_${nanoid(6)}`,
    password: 'testpass123',
    email: `test_${nanoid(6)}@test.com`,
    full_name: 'Test User',
    phone: '+79991234567',
    is_active: true
  }, 'Create user');

  if (newUser.success && newUser.data) {
    testData.user = newUser.data;
    await testEndpoint('PUT', `/users/${newUser.data.id}`, {
      full_name: 'Updated Test User'
    }, 'Update user');
  }

  // Phase 3: Roles & Permissions
  console.log('\n📦 PHASE 3: ROLES & PERMISSIONS');
  console.log('-'.repeat(40));

  await testEndpoint('GET', '/roles', null, 'Get all roles');
  await testEndpoint('GET', '/permissions/me', null, 'Get my permissions');

  const newRole = await testEndpoint('POST', '/roles', {
    name: `TestRole_${nanoid(6)}`,
    description: 'Test role'
  }, 'Create role');

  if (newRole.success && newRole.data) {
    testData.role = newRole.data;
  }

  // Phase 4: CRM/Sales
  console.log('\n📦 PHASE 4: CRM/SALES');
  console.log('-'.repeat(40));

  // Get pipelines and stages
  const pipelines = await testEndpoint('GET', '/sales-pipelines', null, 'Get pipelines');
  const stages = await testEndpoint('GET', '/deal-stages', null, 'Get stages');

  if (pipelines.data && pipelines.data.length > 0) {
    testData.pipeline = pipelines.data[0];
  }

  if (stages.data && stages.data.length > 0) {
    testData.stage = stages.data[0];
  }

  // Create deal with correct schema
  if (testData.stage) {
    const newDeal = await testEndpoint('POST', '/deals', {
      name: `TestDeal_${nanoid(6)}`,
      client_name: 'Test Client', // Added required field
      stage_id: testData.stage.id,
      amount: 100000,
      contact_phone: '+79991234567',
      contact_email: 'client@test.com',
      description: 'Test deal'
    }, 'Create deal');

    if (newDeal.success && newDeal.data) {
      testData.deal = newDeal.data;
      await testEndpoint('GET', `/deals/${newDeal.data.id}`, null, 'Get deal by ID');
    }
  }

  await testEndpoint('GET', '/deals', null, 'Get all deals');

  // Phase 5: Projects
  console.log('\n📦 PHASE 5: PROJECTS');
  console.log('-'.repeat(40));

  const newProject = await testEndpoint('POST', '/projects', {
    name: `TestProject_${nanoid(6)}`,
    client_name: 'Test Customer',  // Fixed: was customer_name
    status: 'pending'  // Fixed: was planning
  }, 'Create project');

  if (newProject.success && newProject.data) {
    testData.project = newProject.data;

    await testEndpoint('GET', `/projects/${newProject.data.id}`, null, 'Get project by ID');

    // Create project stage
    const projectStage = await testEndpoint('POST', `/projects/${newProject.data.id}/stages`, {
      name: 'Test Stage',
      type: 'measurement',
      status: 'pending',
      order: 0,  // Fixed: added required field
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 7*24*60*60*1000).toISOString()
    }, 'Create project stage');

    if (projectStage.success && projectStage.data) {
      testData.projectStage = projectStage.data;
    }

    // Create project item with correct schema
    const projectItem = await testEndpoint('POST', `/projects/${newProject.data.id}/items`, {
      name: 'Test Item',
      quantity: 10,
      price: 1000,
      order: 0  // Fixed: added required field
    }, 'Create project item');

    if (projectItem.success && projectItem.data) {
      testData.projectItem = projectItem.data;
    }
  }

  await testEndpoint('GET', '/projects', null, 'Get all projects');

  // Phase 6: Warehouse
  console.log('\n📦 PHASE 6: WAREHOUSE');
  console.log('-'.repeat(40));

  // Create category
  const newCategory = await testEndpoint('POST', '/warehouse/categories', {
    name: `TestCategory_${nanoid(6)}`,
    description: 'Test category'
  }, 'Create category');

  if (newCategory.success && newCategory.data) {
    testData.warehouse.category = newCategory.data;
  }

  await testEndpoint('GET', '/warehouse/categories', null, 'Get categories');

  // Create warehouse item
  const newItem = await testEndpoint('POST', '/warehouse/items', {
    name: `TestItem_${nanoid(6)}`,
    sku: `SKU_${nanoid(8)}`,
    category_id: testData.warehouse.category?.id,
    description: 'Test item',
    unit: 'pcs',
    quantity: 100,
    min_quantity: 10,
    price: 500
  }, 'Create warehouse item');

  if (newItem.success && newItem.data) {
    testData.warehouse.item = newItem.data;
  }

  await testEndpoint('GET', '/warehouse/items', null, 'Get warehouse items');

  // Create reservation if we have project and item
  if (testData.project && testData.warehouse.item) {
    await testEndpoint('POST', '/warehouse/reservations', {
      item_id: testData.warehouse.item.id,
      project_id: testData.project.id,
      quantity: 5,
      reserved_until: new Date(Date.now() + 7*24*60*60*1000).toISOString()
    }, 'Create reservation');
  }

  // Phase 7: Shipments
  console.log('\n📦 PHASE 7: SHIPMENTS');
  console.log('-'.repeat(40));

  if (testData.project && testData.warehouse.item) {
    const newShipment = await testEndpoint('POST', '/shipments', {
      project_id: testData.project.id,
      project_name: 'Test Project',  // Fixed: added required field
      warehouse_keeper: authHeaders['X-User-ID'],  // Fixed: added required field
      created_by: authHeaders['X-User-ID'],  // Fixed: added required field
      status: 'draft',  // Fixed: changed from 'pending' to 'draft'
      scheduled_date: new Date(Date.now() + 24*60*60*1000).toISOString(),
      address: 'Delivery Address',
      items: [{
        item_id: testData.warehouse.item.id,
        quantity: 2
      }]
    }, 'Create shipment');

    if (newShipment.success && newShipment.data) {
      testData.shipment = newShipment.data;
    }
  }

  await testEndpoint('GET', '/shipments', null, 'Get all shipments');

  // Phase 8: Tasks
  console.log('\n📦 PHASE 8: TASKS');
  console.log('-'.repeat(40));

  const newTask = await testEndpoint('POST', '/tasks', {
    title: `TestTask_${nanoid(6)}`,
    description: 'Test task description',
    priority: 'medium',
    status: 'new',
    assignee_id: authHeaders['X-User-ID'],
    created_by: authHeaders['X-User-ID'],
    deadline: new Date(Date.now() + 3*24*60*60*1000).toISOString()
  }, 'Create task');

  if (newTask.success && newTask.data) {
    testData.task = newTask.data;

    await testEndpoint('GET', `/tasks/${newTask.data.id}`, null, 'Get task by ID');

    // Submit task
    await testEndpoint('POST', `/tasks/${newTask.data.id}/submit`, {
      result_description: 'Task completed'
    }, 'Submit task');
  }

  await testEndpoint('GET', '/tasks', null, 'Get all tasks');

  // Phase 9: Templates
  console.log('\n📦 PHASE 9: TEMPLATES');
  console.log('-'.repeat(40));

  const newTemplate = await testEndpoint('POST', '/templates', {
    name: `Template_${nanoid(6)}`,
    type: 'contract',
    content: 'Template content {{variable}}'
  }, 'Create template');

  if (newTemplate.success && newTemplate.data) {
    testData.template = newTemplate.data;
  }

  await testEndpoint('GET', '/templates', null, 'Get all templates');

  // Phase 10: Additional Endpoints
  console.log('\n📦 PHASE 10: ADDITIONAL ENDPOINTS');
  console.log('-'.repeat(40));

  // Test various GET endpoints
  await testEndpoint('GET', '/finance/accounts', null, 'Get finance accounts');
  await testEndpoint('GET', '/finance/transactions', null, 'Get transactions');
  await testEndpoint('GET', '/reports/dashboard', null, 'Get dashboard');
  await testEndpoint('GET', '/settings', null, 'Get settings');
  await testEndpoint('GET', '/notifications', null, 'Get notifications');
  await testEndpoint('GET', '/audit', null, 'Get audit log');

  // Test search
  await testEndpoint('GET', '/search?q=test', null, 'Global search');

  // Phase 11: Cleanup
  console.log('\n📦 PHASE 11: CLEANUP');
  console.log('-'.repeat(40));

  // Delete test data in reverse order
  if (testData.task) {
    await testEndpoint('DELETE', `/tasks/${testData.task.id}`, null, 'Delete test task');
  }

  if (testData.shipment) {
    await testEndpoint('DELETE', `/shipments/${testData.shipment.id}`, null, 'Delete test shipment');
  }

  if (testData.warehouse.item) {
    await testEndpoint('DELETE', `/warehouse/items/${testData.warehouse.item.id}`, null, 'Delete test item');
  }

  if (testData.warehouse.category) {
    await testEndpoint('DELETE', `/warehouse/categories/${testData.warehouse.category.id}`, null, 'Delete test category');
  }

  if (testData.project) {
    await testEndpoint('DELETE', `/projects/${testData.project.id}`, null, 'Delete test project');
  }

  if (testData.deal) {
    await testEndpoint('DELETE', `/deals/${testData.deal.id}`, null, 'Delete test deal');
  }

  if (testData.template) {
    await testEndpoint('DELETE', `/templates/${testData.template.id}`, null, 'Delete test template');
  }

  if (testData.user) {
    await testEndpoint('DELETE', `/users/${testData.user.id}`, null, 'Delete test user');
  }

  if (testData.role) {
    await testEndpoint('DELETE', `/roles/${testData.role.id}`, null, 'Delete test role');
  }

  // Generate report
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`🔧 Fixed: ${testResults.fixed.length}`);

  if (testResults.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.failed.forEach(test => {
      console.log(`  - ${test.endpoint}`);
      if (test.error) console.log(`    Error: ${test.error}`);
    });
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.passed.length + testResults.failed.length,
      passed: testResults.passed.length,
      failed: testResults.failed.length,
      fixed: testResults.fixed.length
    },
    passed: testResults.passed,
    failed: testResults.failed,
    fixed: testResults.fixed
  };

  fs.writeFileSync('test-fixed-report.json', JSON.stringify(report, null, 2));
  console.log('\n📄 Report saved to test-fixed-report.json');

  const successRate = (testResults.passed.length / (testResults.passed.length + testResults.failed.length) * 100).toFixed(1);
  console.log(`\n📈 Success Rate: ${successRate}%`);

  if (testResults.failed.length === 0) {
    console.log('\n🎉 ALL TESTS PASSED! System is fully functional!');
  } else {
    console.log(`\n⚠️  ${testResults.failed.length} tests failed. Review the errors above.`);
  }
}

runTests().catch(console.error);