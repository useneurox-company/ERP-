import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('Adding new fields to deal_documents table...');

try {
  // Добавляем новые колонки
  const alterStatements = [
    `ALTER TABLE deal_documents ADD COLUMN contract_number TEXT`,
    `ALTER TABLE deal_documents ADD COLUMN contract_date TEXT`,
    `ALTER TABLE deal_documents ADD COLUMN payment_schedule TEXT`,
    `ALTER TABLE deal_documents ADD COLUMN company_info TEXT`,
    `ALTER TABLE deal_documents ADD COLUMN customer_name TEXT`,
    `ALTER TABLE deal_documents ADD COLUMN customer_phone TEXT`,
    `ALTER TABLE deal_documents ADD COLUMN customer_address TEXT`
  ];

  for (const statement of alterStatements) {
    try {
      db.exec(statement);
      console.log('✓', statement);
    } catch (err) {
      // Игнорируем ошибку если колонка уже существует
      if (err.message.includes('duplicate column name')) {
        console.log('⊘ Column already exists:', statement);
      } else {
        throw err;
      }
    }
  }

  console.log('\n✓ Migration completed successfully!');
} catch (error) {
  console.error('✗ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
