import { Router } from "express";
import { procurementService } from "./service";
import { parseExcelWithAI } from "./openrouter";
import { procurementRepository } from "./repository";
import { reservationsRepository } from "../warehouse/reservations.repository";
import multer from "multer";
import * as XLSX from "xlsx";

// Вспомогательная функция для автоматического резервирования
async function autoReserveItem(
  itemId: string,
  warehouseItemId: string | null,
  userId: string | null
): Promise<void> {
  if (!warehouseItemId) return;

  // Получаем item для comparison_id и quantity
  const item = await procurementRepository.getItemById(itemId);
  if (!item) return;

  // Получаем comparison для project_id
  const comparison = await procurementRepository.getComparisonById(item.comparison_id);
  if (!comparison?.project_id) return;

  try {
    await reservationsRepository.createReservation({
      item_id: warehouseItemId,
      project_id: comparison.project_id,
      quantity: item.excel_quantity,
      reserved_by: userId,
      reason: `Снабжение: ${item.excel_name}`,
      status: 'pending'
    });
    console.log(`[Procurement] Auto-reserved ${item.excel_quantity} of ${warehouseItemId} for project ${comparison.project_id}`);
  } catch (err: any) {
    // Не прерываем основной процесс если резервирование не удалось
    console.warn(`[Procurement] Auto-reservation failed for item ${itemId}:`, err.message);
  }
}

const router = Router();

// Настройка multer для загрузки файлов в память
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/procurement/upload - Загрузить Excel и создать сравнение
router.post("/api/procurement/upload", upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { stage_id, project_id } = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!file) {
      res.status(400).json({ error: "Файл не загружен" });
      return;
    }

    if (!stage_id || !project_id) {
      res.status(400).json({ error: "stage_id и project_id обязательны" });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: "Пользователь не авторизован" });
      return;
    }

    // Парсим Excel как raw данные (все ячейки)
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    console.log('[Procurement] Excel rows:', rawData.length);
    console.log('[Procurement] First 5 rows:', rawData.slice(0, 5));

    if (rawData.length === 0) {
      res.status(400).json({
        error: "Файл пуст или имеет неверный формат"
      });
      return;
    }

    let excelData: Array<{ name: string; sku?: string; quantity: number; unit: string }>;

    try {
      // Пробуем AI парсинг через OpenRouter + Gemini
      console.log('[Procurement] Using OpenRouter/Gemini to parse Excel...');
      const aiResult = await parseExcelWithAI(rawData);
      excelData = aiResult.items;
      console.log('[Procurement] AI parsed items:', excelData.length);
    } catch (aiError: any) {
      console.warn('[Procurement] AI parsing failed, falling back to heuristic:', aiError.message);

      // Fallback: эвристический парсинг
      // Ищем строку с заголовками
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (!row) continue;
        const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
        if (rowStr.includes('наименование') || rowStr.includes('название') ||
            rowStr.includes('количество') || rowStr.includes('кол-во')) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        // Если не нашли заголовки, берём первую непустую строку как данные
        headerRowIdx = -1;
      }

      const headers = headerRowIdx >= 0 ? rawData[headerRowIdx] : [];
      let nameIdx = 0, skuIdx = -1, qtyIdx = -1, unitIdx = -1;

      // Определяем индексы колонок
      headers.forEach((h: any, i: number) => {
        const hLower = String(h || '').toLowerCase();
        if (hLower.includes('наимен') || hLower.includes('назван') || hLower.includes('товар') || hLower.includes('материал')) {
          nameIdx = i;
        }
        if (hLower.includes('артикул') || hLower.includes('арт') || hLower.includes('sku') || hLower.includes('код')) {
          skuIdx = i;
        }
        if (hLower.includes('кол') || hLower.includes('qty') || hLower.includes('quantity')) {
          qtyIdx = i;
        }
        if (hLower.includes('ед') || hLower.includes('unit')) {
          unitIdx = i;
        }
      });

      // Парсим данные после заголовков
      excelData = [];
      const startIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
      for (let i = startIdx; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const name = row[nameIdx];
        if (!name || String(name).trim() === '') continue;

        const nameLower = String(name).toLowerCase();
        if (nameLower.includes('итого') || nameLower.includes('всего')) continue;

        excelData.push({
          name: String(name).trim(),
          sku: skuIdx >= 0 && row[skuIdx] ? String(row[skuIdx]).trim() : undefined,
          quantity: qtyIdx >= 0 && row[qtyIdx] ? (parseFloat(row[qtyIdx]) || 1) : 1,
          unit: unitIdx >= 0 && row[unitIdx] ? String(row[unitIdx]).trim() : 'шт'
        });
      }
    }

    if (excelData.length === 0) {
      res.status(400).json({
        error: "Файл не содержит данных о товарах",
        hint: "Проверьте, что файл содержит таблицу с наименованиями товаров"
      });
      return;
    }

    // Создаём сравнение
    const comparison = await procurementService.createComparisonFromExcel(
      stage_id,
      project_id,
      userId,
      file.originalname,
      excelData
    );

    res.status(201).json(comparison);
  } catch (error: any) {
    console.error("Error uploading procurement file:", error);
    res.status(500).json({ error: error.message || "Ошибка загрузки файла" });
  }
});

// POST /api/procurement/:comparisonId/compare - Запустить сравнение с AI
router.post("/api/procurement/:comparisonId/compare", async (req, res) => {
  try {
    const { comparisonId } = req.params;

    const comparison = await procurementService.runComparison(comparisonId);
    res.json(comparison);
  } catch (error: any) {
    console.error("Error running comparison:", error);
    res.status(500).json({ error: error.message || "Ошибка сравнения" });
  }
});

// GET /api/procurement/:comparisonId - Получить сравнение с позициями
router.get("/api/procurement/:comparisonId", async (req, res) => {
  try {
    const { comparisonId } = req.params;

    const result = await procurementService.getComparisonWithItems(comparisonId);
    if (!result) {
      res.status(404).json({ error: "Сравнение не найдено" });
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error getting comparison:", error);
    res.status(500).json({ error: error.message || "Ошибка получения данных" });
  }
});

// GET /api/procurement/stage/:stageId - Получить сравнения для этапа
router.get("/api/procurement/stage/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params;

    const comparisons = await procurementService.getComparisonsByStage(stageId);
    res.json(comparisons);
  } catch (error: any) {
    console.error("Error getting comparisons:", error);
    res.status(500).json({ error: error.message || "Ошибка получения данных" });
  }
});

// PUT /api/procurement/items/:itemId/alternative - Выбрать альтернативу
router.put("/api/procurement/items/:itemId/alternative", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { alternative_id } = req.body;
    const userId = req.headers['x-user-id'] as string || null;

    const item = await procurementService.selectAlternative(itemId, alternative_id || null);
    if (!item) {
      res.status(404).json({ error: "Позиция не найдена" });
      return;
    }

    // Автоматическое резервирование выбранной альтернативы
    if (alternative_id) {
      await autoReserveItem(itemId, alternative_id, userId);
    }

    res.json(item);
  } catch (error: any) {
    console.error("Error selecting alternative:", error);
    res.status(500).json({ error: error.message || "Ошибка выбора альтернативы" });
  }
});

// PUT /api/procurement/items/:itemId/confirm - Подтвердить сопоставление
router.put("/api/procurement/items/:itemId/confirm", async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.headers['x-user-id'] as string || null;

    const item = await procurementService.confirmMatch(itemId);
    if (!item) {
      res.status(404).json({ error: "Позиция не найдена" });
      return;
    }

    // Автоматическое резервирование материала
    await autoReserveItem(itemId, item.warehouse_item_id, userId);

    res.json(item);
  } catch (error: any) {
    console.error("Error confirming match:", error);
    res.status(500).json({ error: error.message || "Ошибка подтверждения" });
  }
});

// PUT /api/procurement/items/:itemId/quantity - Изменить количество
router.put("/api/procurement/items/:itemId/quantity", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (typeof quantity !== 'number' || quantity < 0) {
      res.status(400).json({ error: "Некорректное количество" });
      return;
    }

    const item = await procurementService.updateItemQuantity(itemId, quantity);
    if (!item) {
      res.status(404).json({ error: "Позиция не найдена" });
      return;
    }

    res.json(item);
  } catch (error: any) {
    console.error("Error updating quantity:", error);
    res.status(500).json({ error: error.message || "Ошибка обновления количества" });
  }
});

// PUT /api/procurement/items/:itemId/order - Добавить/убрать из заказа
router.put("/api/procurement/items/:itemId/order", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { add_to_order } = req.body;

    const item = await procurementService.toggleItemInOrder(itemId, Boolean(add_to_order));
    if (!item) {
      res.status(404).json({ error: "Позиция не найдена" });
      return;
    }

    res.json(item);
  } catch (error: any) {
    console.error("Error toggling order:", error);
    res.status(500).json({ error: error.message || "Ошибка обновления заказа" });
  }
});

// PUT /api/procurement/items/:itemId - Обновить данные позиции (поставщик, цена, примечание, статус)
router.put("/api/procurement/items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { supplier_id, price, note, procurement_status, ordered_at, received_at } = req.body;

    const item = await procurementService.updateItem(itemId, {
      supplier_id,
      price: price !== undefined ? parseFloat(price) : undefined,
      note,
      procurement_status,
      ordered_at: ordered_at ? new Date(ordered_at) : undefined,
      received_at: received_at ? new Date(received_at) : undefined,
    });

    if (!item) {
      res.status(404).json({ error: "Позиция не найдена" });
      return;
    }

    res.json(item);
  } catch (error: any) {
    console.error("Error updating item:", error);
    res.status(500).json({ error: error.message || "Ошибка обновления позиции" });
  }
});

// GET /api/procurement/:comparisonId/export - Экспорт заказа в Excel
router.get("/api/procurement/:comparisonId/export", async (req, res) => {
  try {
    const { comparisonId } = req.params;

    const result = await procurementService.getComparisonWithItems(comparisonId);
    if (!result) {
      res.status(404).json({ error: "Сравнение не найдено" });
      return;
    }

    // Фильтруем только позиции в заказе
    const orderItems = result.items.filter((item: any) => item.added_to_order);

    if (orderItems.length === 0) {
      res.status(400).json({ error: "Нет позиций в заказе" });
      return;
    }

    // Создаём Excel
    const data = orderItems.map((item: any, index: number) => ({
      '№': index + 1,
      'Наименование': item.alternative_item?.name || item.warehouse_item?.name || item.excel_name,
      'Артикул': item.alternative_item?.sku || item.warehouse_item?.sku || item.excel_sku || '',
      'Количество': item.quantity_to_order || item.excel_quantity,
      'Ед.изм': item.excel_unit || 'шт',
      'Цена': item.price || '',
      'Сумма': item.price ? (item.price * (item.quantity_to_order || item.excel_quantity)) : '',
      'Поставщик': item.supplier?.name || '',
      'Примечание': item.note || '',
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Устанавливаем ширину колонок
    worksheet['!cols'] = [
      { wch: 5 },   // №
      { wch: 40 },  // Наименование
      { wch: 15 },  // Артикул
      { wch: 12 },  // Количество
      { wch: 8 },   // Ед.изм
      { wch: 12 },  // Цена
      { wch: 12 },  // Сумма
      { wch: 25 },  // Поставщик
      { wch: 30 },  // Примечание
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Заявка на закупку');

    // Генерируем buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Отправляем файл
    const fileName = `Заявка_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Error exporting order:", error);
    res.status(500).json({ error: error.message || "Ошибка экспорта" });
  }
});

// DELETE /api/procurement/:comparisonId - Удалить сравнение
router.delete("/api/procurement/:comparisonId", async (req, res) => {
  try {
    const { comparisonId } = req.params;

    await procurementService.deleteComparison(comparisonId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting comparison:", error);
    res.status(500).json({ error: error.message || "Ошибка удаления" });
  }
});

// ========== SHOPPING CARDS (мини-Kanban) ==========

// GET /api/procurement/stage/:stageId/cards - Получить карточки этапа
router.get("/api/procurement/stage/:stageId/cards", async (req, res) => {
  try {
    const { stageId } = req.params;
    const cards = await procurementRepository.getShoppingCards(stageId);
    res.json(cards);
  } catch (error: any) {
    console.error("Error fetching shopping cards:", error);
    res.status(500).json({ error: error.message || "Ошибка загрузки карточек" });
  }
});

// POST /api/procurement/stage/:stageId/cards - Создать карточку
router.post("/api/procurement/stage/:stageId/cards", async (req, res) => {
  try {
    const { stageId } = req.params;
    const { title, description, status = 'todo' } = req.body;

    if (!title) {
      res.status(400).json({ error: "Название обязательно" });
      return;
    }

    const card = await procurementRepository.createShoppingCard({
      stage_id: stageId,
      title,
      description,
      status,
    });
    res.status(201).json(card);
  } catch (error: any) {
    console.error("Error creating shopping card:", error);
    res.status(500).json({ error: error.message || "Ошибка создания карточки" });
  }
});

// PUT /api/procurement/cards/:cardId - Обновить карточку
router.put("/api/procurement/cards/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params;
    const { title, description, status, order_index } = req.body;

    const card = await procurementRepository.updateShoppingCard(cardId, {
      title,
      description,
      status,
      order_index,
    });

    if (!card) {
      res.status(404).json({ error: "Карточка не найдена" });
      return;
    }

    res.json(card);
  } catch (error: any) {
    console.error("Error updating shopping card:", error);
    res.status(500).json({ error: error.message || "Ошибка обновления карточки" });
  }
});

// DELETE /api/procurement/cards/:cardId - Удалить карточку
router.delete("/api/procurement/cards/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params;
    await procurementRepository.deleteShoppingCard(cardId);
    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting shopping card:", error);
    res.status(500).json({ error: error.message || "Ошибка удаления карточки" });
  }
});

export { router as procurementRouter };
