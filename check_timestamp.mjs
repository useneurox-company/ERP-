import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('Checking timestamp format...\n');

// Check existing shipment
const shipment = db.prepare('SELECT created_at FROM shipments LIMIT 1').get();
console.log('Existing shipment created_at:', shipment?.created_at);

// Check what format it is
if (shipment) {
  const tsInSeconds = shipment.created_at;
  const tsInMillis = shipment.created_at * 1000;

  console.log('\nIf timestamp is in seconds:');
  console.log('  Date:', new Date(tsInSeconds).toISOString());

  console.log('\nIf timestamp is in milliseconds:');
  console.log('  Date:', new Date(tsInMillis).toISOString());
}

console.log('\nCurrent time:');
console.log('  In milliseconds:', Date.now());
console.log('  In seconds:', Math.floor(Date.now() / 1000));
console.log('  ISO:', new Date().toISOString());

// Test the date query
console.log('\nTesting date query from shipments.repository.ts:');
const query = `
  SELECT shipment_number, created_at,
         DATE(created_at / 1000, 'unixepoch') as date_calc,
         DATE('now') as date_now
  FROM shipments
  ORDER BY created_at DESC
  LIMIT 1
`;
const result = db.prepare(query).get();
console.log('Query result:', JSON.stringify(result, null, 2));

db.close();
