import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import path from "path";

const dbPath = path.join(process.cwd(), ".local", "emerald_erp.db");
const db = new Database(dbPath);

console.log("🔄 Начинаю миграцию для добавления категорий склада...");

try {
  // 1. Создать таблицу warehouse_categories
  console.log("1️⃣  Создаю таблицу warehouse_categories...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS warehouse_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES warehouse_categories(id) ON DELETE CASCADE,
      icon TEXT,
      color TEXT,
      "order" INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  console.log("✅ Таблица warehouse_categories создана");

  // 2. Проверить, есть ли уже колонка category_id
  const tableInfo = db.prepare("PRAGMA table_info(warehouse_items)").all() as any[];
  const hasCategoryId = tableInfo.some((col: any) => col.name === 'category_id');

  if (!hasCategoryId) {
    console.log("2️⃣  Добавляю колонку category_id к warehouse_items...");
    db.exec(`
      ALTER TABLE warehouse_items ADD COLUMN category_id TEXT REFERENCES warehouse_categories(id);
    `);
    console.log("✅ Колонка category_id добавлена");
  } else {
    console.log("⏭️  Колонка category_id уже существует");
  }

  // 3. Добавить начальные категории
  console.log("3️⃣  Добавляю начальные категории...");

  const existingCategories = db.prepare("SELECT COUNT(*) as count FROM warehouse_categories").get() as { count: number };

  if (existingCategories.count === 0) {
    // Материалы (root)
    const materialsId = nanoid();
    db.prepare(`
      INSERT INTO warehouse_categories (id, name, parent_id, icon, color, "order", created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
    `).run(materialsId, "Материалы", "📦", "#3b82f6", 1, new Date().toISOString(), new Date().toISOString());

    // Подкатегории для Материалов
    const materialSubs = [
      { name: "МДФ", icon: "🪵", color: "#8b5a3c" },
      { name: "Фурнитура", icon: "🔩", color: "#6b7280" },
      { name: "ЛКМ", icon: "🎨", color: "#ec4899" },
      { name: "Кромка", icon: "📏", color: "#10b981" },
      { name: "Стекло", icon: "🪟", color: "#06b6d4" },
      { name: "Зеркало", icon: "🪞", color: "#8b5cf6" },
      { name: "Столешницы", icon: "🪟", color: "#f59e0b" },
    ];

    materialSubs.forEach((sub, index) => {
      db.prepare(`
        INSERT INTO warehouse_categories (id, name, parent_id, icon, color, "order", created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(nanoid(), sub.name, materialsId, sub.icon, sub.color, index + 1, new Date().toISOString(), new Date().toISOString());
    });

    // Готовая продукция (root)
    const productsId = nanoid();
    db.prepare(`
      INSERT INTO warehouse_categories (id, name, parent_id, icon, color, "order", created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, ?)
    `).run(productsId, "Готовая продукция", "🏭", "#22c55e", 2, new Date().toISOString(), new Date().toISOString());

    // Подкатегории для Готовой продукции
    const productSubs = [
      { name: "Шкафы", icon: "🚪", color: "#0ea5e9" },
      { name: "Столы", icon: "🪑", color: "#f97316" },
      { name: "Двери", icon: "🚪", color: "#84cc16" },
      { name: "Полки", icon: "📚", color: "#a855f7" },
      { name: "Кухни", icon: "🍳", color: "#ef4444" },
      { name: "Упаковки", icon: "📦", color: "#64748b" },
    ];

    productSubs.forEach((sub, index) => {
      db.prepare(`
        INSERT INTO warehouse_categories (id, name, parent_id, icon, color, "order", created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(nanoid(), sub.name, productsId, sub.icon, sub.color, index + 1, new Date().toISOString(), new Date().toISOString());
    });

    console.log(`✅ Создано ${2 + materialSubs.length + productSubs.length} категорий`);
  } else {
    console.log(`⏭️  Категории уже существуют (${existingCategories.count} шт.)`);
  }

  console.log("✅ Миграция успешно завершена!");
} catch (error) {
  console.error("❌ Ошибка миграции:", error);
  process.exit(1);
} finally {
  db.close();
  process.exit(0);
}
