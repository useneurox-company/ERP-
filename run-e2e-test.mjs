#!/usr/bin/env node

import { nanoid } from 'nanoid';

const BASE_URL = 'http://localhost:5000';

console.log('\n🧪 Sales Module E2E API Test\n');
console.log('Testing API endpoints for CRUD operations...\n');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function apiRequest(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function runAPITest() {
  const uniqueClientName = `Test Client ${nanoid(6)}`;
  const uniqueCompany = `Test Company ${nanoid(6)}`;
  let createdDealId = null;

  try {
    // Step 1: Get all deals
    console.log('📋 Step 1: Fetching all deals...');
    const deals = await apiRequest('GET', '/api/deals');
    console.log(`✅ Found ${deals.length} existing deals`);

    if (deals.length === 0) {
      console.log('⚠️  No existing deals found. Creating a sample deal first...');
      const sampleDeal = await apiRequest('POST', '/api/deals', {
        client_name: 'Sample Client',
        company: 'Sample Company',
        amount: '10000',
        stage: 'new',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        manager_id: null,
        tags: ['sample'],
      });
      console.log(`✅ Sample deal created with ID: ${sampleDeal.id}`);
    }

    // Step 2: Get first deal details
    console.log('\n📋 Step 2: Getting first deal details...');
    const firstDeal = deals.length > 0 ? deals[0] : await apiRequest('GET', '/api/deals').then(d => d[0]);
    console.log(`✅ Deal details: ${firstDeal.client_name} - ${firstDeal.company || 'No company'}`);

    // Step 3: Create new deal
    console.log('\n📋 Step 3: Creating new deal...');
    const newDeal = {
      client_name: uniqueClientName,
      company: uniqueCompany,
      amount: '50000',
      stage: 'meeting',
      deadline: null,
      manager_id: null,
      tags: ['test', 'e2e'],
    };

    const createdDeal = await apiRequest('POST', '/api/deals', newDeal);
    createdDealId = createdDeal.id;
    console.log(`✅ Created deal with ID: ${createdDealId}`);
    console.log(`   Client: ${createdDeal.client_name}`);
    console.log(`   Company: ${createdDeal.company}`);
    console.log(`   Amount: ${createdDeal.amount}`);

    await sleep(500);

    // Step 4: Verify deal appears in list
    console.log('\n📋 Step 4: Verifying deal appears in list...');
    const updatedDeals = await apiRequest('GET', '/api/deals');
    const foundDeal = updatedDeals.find(d => d.id === createdDealId);
    if (!foundDeal) {
      throw new Error('Created deal not found in list');
    }
    console.log(`✅ Deal found in list with ${updatedDeals.length} total deals`);

    // Step 5: Update the deal
    console.log('\n📋 Step 5: Updating the deal...');
    const updateData = {
      client_name: uniqueClientName,
      company: uniqueCompany,
      amount: '75000',
      stage: 'proposal',
      deadline: createdDeal.deadline,
      manager_id: null,
      tags: ['test', 'e2e', 'updated'],
    };

    const updatedDeal = await apiRequest('PUT', `/api/deals/${createdDealId}`, updateData);
    console.log(`✅ Deal updated successfully`);
    console.log(`   New amount: ${updatedDeal.amount} (was 50000)`);
    console.log(`   New stage: ${updatedDeal.stage} (was meeting)`);

    await sleep(500);

    // Step 6: Get updated deal
    console.log('\n📋 Step 6: Fetching updated deal...');
    const refreshedDeal = await apiRequest('GET', `/api/deals/${createdDealId}`);
    const expectedAmount = parseFloat('75000');
    const actualAmount = parseFloat(refreshedDeal.amount);
    if (actualAmount !== expectedAmount) {
      throw new Error(`Amount not updated correctly. Expected ${expectedAmount}, got ${actualAmount}`);
    }
    if (refreshedDeal.stage !== 'proposal') {
      throw new Error(`Stage not updated correctly. Expected proposal, got ${refreshedDeal.stage}`);
    }
    console.log(`✅ Deal data verified after update`);

    // Step 7: Delete the deal
    console.log('\n📋 Step 7: Deleting the deal...');
    await apiRequest('DELETE', `/api/deals/${createdDealId}`);
    console.log(`✅ Deal deleted successfully`);

    await sleep(500);

    // Step 8: Verify deal is deleted
    console.log('\n📋 Step 8: Verifying deal is deleted...');
    const finalDeals = await apiRequest('GET', '/api/deals');
    const deletedDeal = finalDeals.find(d => d.id === createdDealId);
    if (deletedDeal) {
      throw new Error('Deal still exists after deletion');
    }
    console.log(`✅ Deal successfully removed from list`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL E2E API TESTS PASSED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('\n📊 Test Summary:');
    console.log(`   • Created deal: ${uniqueClientName}`);
    console.log(`   • Company: ${uniqueCompany}`);
    console.log(`   • Initial amount: 50000 ₽`);
    console.log(`   • Updated amount: 75000 ₽`);
    console.log(`   • Stage progression: meeting → proposal`);
    console.log(`   • Successfully deleted`);
    console.log('\n✨ All CRUD operations working correctly!\n');

    return true;
  } catch (error) {
    console.error('\n❌ E2E API TEST FAILED');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    
    // Cleanup: try to delete the created deal if it exists
    if (createdDealId) {
      try {
        await apiRequest('DELETE', `/api/deals/${createdDealId}`);
        console.log('🧹 Cleanup: Test deal deleted');
      } catch (cleanupError) {
        console.error('⚠️  Cleanup failed:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

console.log('🌐 Testing against:', BASE_URL);
console.log('');

runAPITest().then(() => {
  console.log('✅ Test completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
