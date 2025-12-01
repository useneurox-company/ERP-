import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

const dbPath = join(process.cwd(), '.local', 'emerald_erp.db');
const db = new Database(dbPath);

console.log('📂 Applying migration to:', dbPath);

try {
  const sql = readFileSync(join(process.cwd(), 'create_task_attachments.sql'), 'utf-8');

  // Split by semicolon and execute each statement
  const statements = sql.split(';').filter(s => s.trim());

  statements.forEach((statement, index) => {
    if (statement.trim()) {
      console.log(`Executing statement ${index + 1}/${statements.length}`);
      db.exec(statement);
    }
  });

  console.log('✅ Migration applied successfully!');
} catch (error) {
  console.error('❌ Error applying migration:', error);
  process.exit(1);
} finally {
  db.close();
}
