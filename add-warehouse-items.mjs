import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp';
const pool = new Pool({ connectionString: DATABASE_URL });

async function addWarehouseItems() {
  const client = await pool.connect();

  try {
    console.log('📦 Adding warehouse items...\n');

    const items = [
      { name: 'ДСП 16мм Белый', sku: 'DSP-16-WHITE', category: 'Материалы', unit: 'лист', quantity: 100, price: 1500, min_stock_level: 20, track_min_stock: true },
      { name: 'ДСП 18мм Дуб', sku: 'DSP-18-OAK', category: 'Материалы', unit: 'лист', quantity: 75, price: 1800, min_stock_level: 15, track_min_stock: true },
      { name: 'ДСП 25мм Серый', sku: 'DSP-25-GRAY', category: 'Материалы', unit: 'лист', quantity: 50, price: 2200, min_stock_level: 10, track_min_stock: true },
      { name: 'МДФ 10мм', sku: 'MDF-10', category: 'Материалы', unit: 'лист', quantity: 50, price: 1200, min_stock_level: 10, track_min_stock: true },
      { name: 'МДФ 16мм Глянец', sku: 'MDF-16-GLOSS', category: 'Материалы', unit: 'лист', quantity: 40, price: 2500, min_stock_level: 10, track_min_stock: true },
      { name: 'ДВП 3мм', sku: 'DVP-3', category: 'Материалы', unit: 'лист', quantity: 200, price: 350, min_stock_level: 50, track_min_stock: true },
      { name: 'Кромка ПВХ 0.4мм Белая', sku: 'EDGE-PVC-04-WHITE', category: 'Фурнитура', unit: 'м.п.', quantity: 1000, price: 12, min_stock_level: 200, track_min_stock: true },
      { name: 'Кромка ПВХ 2мм Белая', sku: 'EDGE-PVC-2-WHITE', category: 'Фурнитура', unit: 'м.п.', quantity: 500, price: 25, min_stock_level: 100, track_min_stock: true },
      { name: 'Кромка ПВХ 2мм Дуб', sku: 'EDGE-PVC-2-OAK', category: 'Фурнитура', unit: 'м.п.', quantity: 300, price: 28, min_stock_level: 50, track_min_stock: true },
      { name: 'Петля накладная', sku: 'HINGE-01', category: 'Фурнитура', unit: 'шт', quantity: 200, price: 150, min_stock_level: 50, track_min_stock: true },
      { name: 'Петля полунакладная', sku: 'HINGE-02', category: 'Фурнитура', unit: 'шт', quantity: 150, price: 160, min_stock_level: 30, track_min_stock: true },
      { name: 'Петля вкладная', sku: 'HINGE-03', category: 'Фурнитура', unit: 'шт', quantity: 100, price: 170, min_stock_level: 20, track_min_stock: true },
      { name: 'Ручка-скоба 96мм', sku: 'HANDLE-96', category: 'Фурнитура', unit: 'шт', quantity: 200, price: 200, min_stock_level: 40, track_min_stock: true },
      { name: 'Ручка-скоба 128мм', sku: 'HANDLE-128', category: 'Фурнитура', unit: 'шт', quantity: 150, price: 250, min_stock_level: 30, track_min_stock: true },
      { name: 'Ручка-скоба 160мм', sku: 'HANDLE-160', category: 'Фурнитура', unit: 'шт', quantity: 100, price: 300, min_stock_level: 20, track_min_stock: true },
      { name: 'Ручка-кнопка хром', sku: 'KNOB-CHROME', category: 'Фурнитура', unit: 'шт', quantity: 300, price: 120, min_stock_level: 50, track_min_stock: true },
      { name: 'Направляющие 350мм', sku: 'SLIDE-350', category: 'Фурнитура', unit: 'комплект', quantity: 100, price: 380, min_stock_level: 20, track_min_stock: true },
      { name: 'Направляющие 450мм', sku: 'SLIDE-450', category: 'Фурнитура', unit: 'комплект', quantity: 80, price: 450, min_stock_level: 20, track_min_stock: true },
      { name: 'Направляющие 550мм', sku: 'SLIDE-550', category: 'Фурнитура', unit: 'комплект', quantity: 60, price: 520, min_stock_level: 15, track_min_stock: true },
      { name: 'Полкодержатель', sku: 'SHELF-HOLDER', category: 'Фурнитура', unit: 'шт', quantity: 500, price: 15, min_stock_level: 100, track_min_stock: true },
      { name: 'Ножка мебельная 100мм', sku: 'LEG-100', category: 'Фурнитура', unit: 'шт', quantity: 200, price: 80, min_stock_level: 40, track_min_stock: true },
      { name: 'Клей ПВА', sku: 'GLUE-PVA', category: 'Расходники', unit: 'кг', quantity: 25, price: 120, min_stock_level: 5, track_min_stock: true },
      { name: 'Клей Момент', sku: 'GLUE-MOMENT', category: 'Расходники', unit: 'шт', quantity: 50, price: 250, min_stock_level: 10, track_min_stock: true },
      { name: 'Герметик силиконовый', sku: 'SEALANT-SIL', category: 'Расходники', unit: 'шт', quantity: 30, price: 350, min_stock_level: 5, track_min_stock: true },
      { name: 'Саморез 3.5x16', sku: 'SCREW-3516', category: 'Крепеж', unit: 'шт', quantity: 5000, price: 2, min_stock_level: 1000, track_min_stock: true },
      { name: 'Саморез 3.5x25', sku: 'SCREW-3525', category: 'Крепеж', unit: 'шт', quantity: 3000, price: 2.5, min_stock_level: 500, track_min_stock: true },
      { name: 'Саморез 4x30', sku: 'SCREW-430', category: 'Крепеж', unit: 'шт', quantity: 2000, price: 3, min_stock_level: 400, track_min_stock: true },
      { name: 'Конфирмат 7x50', sku: 'CONFIRM-750', category: 'Крепеж', unit: 'шт', quantity: 2000, price: 5, min_stock_level: 500, track_min_stock: true },
      { name: 'Эксцентрик', sku: 'ECCENTRIC', category: 'Крепеж', unit: 'комплект', quantity: 500, price: 25, min_stock_level: 100, track_min_stock: true },
      { name: 'Стяжка межсекционная', sku: 'CONNECTOR', category: 'Крепеж', unit: 'шт', quantity: 200, price: 35, min_stock_level: 40, track_min_stock: true },
    ];

    for (const item of items) {
      try {
        // Check if item with this SKU already exists
        const existing = await client.query('SELECT id FROM warehouse_items WHERE sku = $1', [item.sku]);

        if (existing.rows.length === 0) {
          const id = 'wh_' + Math.random().toString(36).substr(2, 9);
          await client.query(`
            INSERT INTO warehouse_items (
              id, name, sku, category, unit, quantity, price,
              min_stock_level, track_min_stock, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `, [
            id, item.name, item.sku, item.category, item.unit,
            item.quantity, item.price, item.min_stock_level, item.track_min_stock
          ]);
          console.log(`✅ Added: ${item.name}`);
        } else {
          console.log(`⏭️  Skipped (exists): ${item.name}`);
        }
      } catch (err) {
        console.error(`❌ Error adding ${item.name}:`, err.message);
      }
    }

    const count = await client.query('SELECT COUNT(*) FROM warehouse_items');
    console.log(`\n📊 Total warehouse items: ${count.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addWarehouseItems().catch(err => {
  console.error(err);
  process.exit(1);
});