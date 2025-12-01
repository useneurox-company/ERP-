import pg from 'pg';
const { Pool } = pg;

// Production PostgreSQL connection
const DATABASE_URL = 'postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp';
const pool = new Pool({ connectionString: DATABASE_URL });

async function checkProductionWarehouse() {
  const client = await pool.connect();

  try {
    console.log('🔍 Проверка production базы данных...\n');

    // Check warehouse_items table structure
    console.log('📋 Структура таблицы warehouse_items:');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'warehouse_items'
      ORDER BY ordinal_position;
    `);

    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

    // Check for track_min_stock and project_id
    const hasTrackMinStock = columns.rows.some(col => col.column_name === 'track_min_stock');
    const hasProjectId = columns.rows.some(col => col.column_name === 'project_id');

    console.log('\n🔑 Ключевые колонки:');
    console.log(`   track_min_stock: ${hasTrackMinStock ? '✅ Есть' : '❌ Отсутствует'}`);
    console.log(`   project_id: ${hasProjectId ? '✅ Есть' : '❌ Отсутствует'}`);

    // Check products count
    console.log('\n📦 Товары на складе:');

    const totalItems = await client.query('SELECT COUNT(*) FROM warehouse_items');
    console.log(`   Всего позиций: ${totalItems.rows[0].count}`);

    const productItems = await client.query(`
      SELECT COUNT(*) FROM warehouse_items
      WHERE category = 'products'
    `);
    console.log(`   Готовая продукция (category='products'): ${productItems.rows[0].count}`);

    const availableProducts = await client.query(`
      SELECT COUNT(*) FROM warehouse_items
      WHERE category = 'products' AND quantity > 0
    `);
    console.log(`   Доступно для отгрузки (quantity > 0): ${availableProducts.rows[0].count}`);

    // Show some example products
    const exampleProducts = await client.query(`
      SELECT id, name, sku, category, quantity, unit
      FROM warehouse_items
      WHERE category = 'products'
      LIMIT 5
    `);

    if (exampleProducts.rows.length > 0) {
      console.log('\n📝 Примеры товаров:');
      exampleProducts.rows.forEach(item => {
        console.log(`   - ${item.name} (${item.sku || 'без арт.'}) - ${item.quantity} ${item.unit}`);
      });
    } else {
      console.log('\n⚠️  Нет товаров с category="products"');
    }

    // Check materials for comparison
    const materials = await client.query(`
      SELECT COUNT(*) FROM warehouse_items
      WHERE category = 'materials'
    `);
    console.log(`\n📦 Материалы (category='materials'): ${materials.rows[0].count}`);

    console.log('\n✅ Проверка завершена!\n');

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkProductionWarehouse().catch(err => {
  console.error(err);
  process.exit(1);
});
