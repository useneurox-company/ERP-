import pg from 'pg';
import { nanoid } from 'nanoid';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://emerald_user:EmeraldSecure2025!@localhost:5432/emerald_erp';
const pool = new Pool({ connectionString: DATABASE_URL });

async function addTestProducts() {
  const client = await pool.connect();

  try {
    console.log('📦 Добавление тестовых товаров...\n');

    // Check if products already exist
    const existing = await client.query(`
      SELECT COUNT(*) FROM warehouse_items
      WHERE category = 'products' AND quantity > 0
    `);

    if (parseInt(existing.rows[0].count) > 0) {
      console.log(`✓ Уже есть ${existing.rows[0].count} товар(ов) с quantity > 0`);
      console.log('Пропускаем добавление тестовых данных.\n');
      return;
    }

    // Add test products
    const testProducts = [
      {
        id: nanoid(),
        name: 'Светильник LED потолочный',
        sku: 'LED-CEIL-001',
        barcode: nanoid(),
        quantity: 15,
        reserved_quantity: 0,
        unit: 'шт',
        price: 2500,
        location: 'Склад А, стеллаж 1',
        category: 'products',
        supplier: 'ООО "Светотехника"',
        description: 'Светодиодный потолочный светильник 36W',
        min_stock: 5,
        track_min_stock: true,
        status: 'normal',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: nanoid(),
        name: 'Выключатель двухклавишный',
        sku: 'SW-2BTN-001',
        barcode: nanoid(),
        quantity: 50,
        reserved_quantity: 0,
        unit: 'шт',
        price: 350,
        location: 'Склад А, стеллаж 2',
        category: 'products',
        supplier: 'ООО "Электротехника"',
        description: 'Выключатель 2-клавишный белый',
        min_stock: 10,
        track_min_stock: true,
        status: 'normal',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: nanoid(),
        name: 'Розетка с заземлением',
        sku: 'SKT-GND-001',
        barcode: nanoid(),
        quantity: 80,
        reserved_quantity: 0,
        unit: 'шт',
        price: 280,
        location: 'Склад А, стеллаж 2',
        category: 'products',
        supplier: 'ООО "Электротехника"',
        description: 'Розетка с заземлением белая',
        min_stock: 20,
        track_min_stock: true,
        status: 'normal',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: nanoid(),
        name: 'Кабель ВВГнг 3x2.5',
        sku: 'CBL-VVG-325',
        barcode: nanoid(),
        quantity: 500,
        reserved_quantity: 0,
        unit: 'м',
        price: 85,
        location: 'Склад Б, зона 1',
        category: 'products',
        supplier: 'ООО "Кабель"',
        description: 'Кабель ВВГнг 3x2.5 мм² (бухта)',
        min_stock: 100,
        track_min_stock: true,
        status: 'normal',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: nanoid(),
        name: 'Распределительная коробка',
        sku: 'BOX-DIST-001',
        barcode: nanoid(),
        quantity: 120,
        reserved_quantity: 0,
        unit: 'шт',
        price: 45,
        location: 'Склад А, стеллаж 3',
        category: 'products',
        supplier: 'ООО "Электротехника"',
        description: 'Коробка распределительная 80x80 мм',
        min_stock: 30,
        track_min_stock: true,
        status: 'normal',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    for (const product of testProducts) {
      await client.query(`
        INSERT INTO warehouse_items (
          id, name, sku, barcode, quantity, reserved_quantity, unit,
          price, location, category, supplier, description, min_stock,
          track_min_stock, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
      `, [
        product.id, product.name, product.sku, product.barcode,
        product.quantity, product.reserved_quantity, product.unit,
        product.price, product.location, product.category, product.supplier,
        product.description, product.min_stock, product.track_min_stock,
        product.status, product.created_at, product.updated_at
      ]);

      console.log(`✅ Добавлен: ${product.name} (${product.quantity} ${product.unit})`);
    }

    console.log(`\n🎉 Успешно добавлено ${testProducts.length} товаров!\n`);

    // Show summary
    const totalProducts = await client.query(`
      SELECT COUNT(*) FROM warehouse_items
      WHERE category = 'products' AND quantity > 0
    `);

    console.log(`📊 Итого товаров доступно для отгрузки: ${totalProducts.rows[0].count}\n`);

  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addTestProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
