import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../.local/emerald_erp.db');

console.log(`📂 Connecting to database at: ${dbPath}`);

const db = new Database(dbPath);

try {
  console.log('Adding comment column to deal_documents table...');
  db.exec(`ALTER TABLE deal_documents ADD COLUMN comment TEXT;`);
  console.log('✓ Added comment column to deal_documents');
} catch (error: any) {
  if (error.message.includes('duplicate column name')) {
    console.log('✓ comment column already exists in deal_documents');
  } else {
    console.error('Error adding comment column:', error.message);
  }
}

try {
  console.log('Adding document_id column to deal_attachments table...');
  db.exec(`ALTER TABLE deal_attachments ADD COLUMN document_id TEXT REFERENCES deal_documents(id) ON DELETE CASCADE;`);
  console.log('✓ Added document_id column to deal_attachments');
} catch (error: any) {
  if (error.message.includes('duplicate column name')) {
    console.log('✓ document_id column already exists in deal_attachments');
  } else {
    console.error('Error adding document_id column:', error.message);
  }
}

db.close();
console.log('✓ Migration completed successfully!');
