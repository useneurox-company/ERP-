import { db } from "../db";
import { warehouseCategories } from "@shared/schema";
import { nanoid } from "nanoid";

async function seedWarehouseCategories() {
  console.log("🌱 Seeding warehouse categories...");

  try {
    // Проверить, есть ли уже категории
    const existingCategories = await db.select().from(warehouseCategories);

    if (existingCategories.length > 0) {
      console.log(`⚠️  Категории уже существуют (${existingCategories.length} шт.). Пропускаем seed.`);
      return;
    }

    // Корневая категория 1: Материалы
    const materialsId = nanoid();
    await db.insert(warehouseCategories).values({
      id: materialsId,
      name: "Материалы",
      parent_id: null,
      icon: "📦",
      color: "#3b82f6", // blue
      order: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });
    console.log("✅ Создана корневая категория: Материалы");

    // Подкатегории для Материалов
    const materialSubcategories = [
      { name: "МДФ", icon: "🪵", color: "#8b5a3c" },
      { name: "Фурнитура", icon: "🔩", color: "#6b7280" },
      { name: "ЛКМ", icon: "🎨", color: "#ec4899" },
      { name: "Кромка", icon: "📏", color: "#10b981" },
      { name: "Стекло", icon: "🪟", color: "#06b6d4" },
      { name: "Зеркало", icon: "🪞", color: "#8b5cf6" },
      { name: "Столешницы", icon: "🪟", color: "#f59e0b" },
    ];

    let order = 1;
    for (const subcat of materialSubcategories) {
      await db.insert(warehouseCategories).values({
        id: nanoid(),
        name: subcat.name,
        parent_id: materialsId,
        icon: subcat.icon,
        color: subcat.color,
        order: order++,
        created_at: new Date(),
        updated_at: new Date(),
      });
      console.log(`  ✅ Подкатегория: ${subcat.name}`);
    }

    // Корневая категория 2: Готовая продукция
    const productsId = nanoid();
    await db.insert(warehouseCategories).values({
      id: productsId,
      name: "Готовая продукция",
      parent_id: null,
      icon: "🏭",
      color: "#22c55e", // green
      order: 2,
      created_at: new Date(),
      updated_at: new Date(),
    });
    console.log("✅ Создана корневая категория: Готовая продукция");

    // Подкатегории для Готовой продукции
    const productSubcategories = [
      { name: "Шкафы", icon: "🚪", color: "#0ea5e9" },
      { name: "Столы", icon: "🪑", color: "#f97316" },
      { name: "Двери", icon: "🚪", color: "#84cc16" },
      { name: "Полки", icon: "📚", color: "#a855f7" },
      { name: "Кухни", icon: "🍳", color: "#ef4444" },
      { name: "Упаковки", icon: "📦", color: "#64748b" },
    ];

    order = 1;
    for (const subcat of productSubcategories) {
      await db.insert(warehouseCategories).values({
        id: nanoid(),
        name: subcat.name,
        parent_id: productsId,
        icon: subcat.icon,
        color: subcat.color,
        order: order++,
        created_at: new Date(),
        updated_at: new Date(),
      });
      console.log(`  ✅ Подкатегория: ${subcat.name}`);
    }

    console.log("✅ Seed успешно завершен!");
    console.log(`📊 Создано категорий: ${2 + materialSubcategories.length + productSubcategories.length}`);
  } catch (error) {
    console.error("❌ Ошибка при создании seed-данных:", error);
    throw error;
  }
}

// Запуск seed если файл вызван напрямую
// ES модули не поддерживают require.main, поэтому просто запускаем
seedWarehouseCategories()
  .then(() => {
    console.log("✅ Seed завершен успешно");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Ошибка seed:", error);
    process.exit(1);
  });

export { seedWarehouseCategories };
