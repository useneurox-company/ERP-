import Database from 'better-sqlite3';

const db = new Database('.local/emerald_erp.db');

try {
  console.log('Adding chat features to deal_messages table...');

  // Check if columns already exist
  const tableInfo = db.prepare(`PRAGMA table_info(deal_messages)`).all();
  const existingColumns = tableInfo.map(col => col.name);

  // Add direction column if it doesn't exist
  if (!existingColumns.includes('direction')) {
    db.exec(`ALTER TABLE deal_messages ADD COLUMN direction TEXT DEFAULT 'outgoing'`);
    console.log('✅ Added column: direction');
  } else {
    console.log('ℹ️  Column direction already exists, skipping');
  }

  // Add is_read column if it doesn't exist
  if (!existingColumns.includes('is_read')) {
    db.exec(`ALTER TABLE deal_messages ADD COLUMN is_read INTEGER DEFAULT 0`);
    console.log('✅ Added column: is_read');
  } else {
    console.log('ℹ️  Column is_read already exists, skipping');
  }

  // Add read_at column if it doesn't exist
  if (!existingColumns.includes('read_at')) {
    db.exec(`ALTER TABLE deal_messages ADD COLUMN read_at TEXT`);
    console.log('✅ Added column: read_at');
  } else {
    console.log('ℹ️  Column read_at already exists, skipping');
  }

  // Create index for unread messages query optimization
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_deal_messages_unread
    ON deal_messages(deal_id, is_read)
    WHERE is_read = 0
  `);
  console.log('✅ Index created for unread messages');

  // Verify columns exist
  const updatedTableInfo = db.prepare(`PRAGMA table_info(deal_messages)`).all();
  const updatedColumns = updatedTableInfo.map(col => col.name);

  const requiredColumns = ['direction', 'is_read', 'read_at'];
  const missingColumns = requiredColumns.filter(col => !updatedColumns.includes(col));

  if (missingColumns.length === 0) {
    console.log('✅ Verification: All chat feature columns exist');
    console.log(`   Columns: ${requiredColumns.join(', ')}`);
  } else {
    console.error(`❌ Verification failed: Missing columns: ${missingColumns.join(', ')}`);
    process.exit(1);
  }

  console.log('\n🎉 Migration completed successfully!');

} catch (error) {
  console.error('❌ Error during migration:', error);
  process.exit(1);
} finally {
  db.close();
}
