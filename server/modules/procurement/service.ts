import { procurementRepository } from "./repository";
import { compareWithAI, type ExcelItem, type AiMatch } from "./openrouter";
import type { ProcurementComparison, ProcurementComparisonItem } from "@shared/schema";

interface ExcelData {
  name: string;
  sku?: string;
  quantity: number;
  unit?: string;
}

interface ComparisonItemWithWarehouse extends ProcurementComparisonItem {
  warehouse_item?: {
    id: string;
    name: string;
    sku?: string;
    quantity: number;
    unit?: string;
  } | null;
  alternative_item?: {
    id: string;
    name: string;
    sku?: string;
    quantity: number;
    unit?: string;
  } | null;
  supplier?: {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
  } | null;
  ai_suggestions_parsed?: Array<{
    id: string;
    name: string;
    sku?: string;
    quantity: number;
    available_quantity: number;
    confidence: string;
  }>;
}

export const procurementService = {
  // Создать сравнение и загрузить данные из Excel
  async createComparisonFromExcel(
    stageId: string,
    projectId: string,
    userId: string,
    fileName: string,
    excelData: ExcelData[]
  ): Promise<ProcurementComparison> {
    // Создаём сравнение
    const comparison = await procurementRepository.createComparison({
      stage_id: stageId,
      project_id: projectId,
      created_by: userId,
      file_name: fileName,
      status: 'draft',
      total_items: excelData.length,
      items_in_stock: 0,
      items_partial: 0,
      items_missing: 0
    });

    // Создаём позиции
    const items = excelData.map(excel => ({
      comparison_id: comparison.id,
      excel_name: excel.name,
      excel_sku: excel.sku || null,
      excel_quantity: excel.quantity,
      excel_unit: excel.unit || 'шт',
      status: 'pending'
    }));

    await procurementRepository.createManyItems(items);

    return comparison;
  },

  // Выполнить сравнение со складом через AI
  async runComparison(comparisonId: string): Promise<ProcurementComparison> {
    const comparison = await procurementRepository.getComparisonById(comparisonId);
    if (!comparison) {
      throw new Error('Сравнение не найдено');
    }

    // Обновляем статус
    await procurementRepository.updateComparison(comparisonId, { status: 'comparing' });

    // Получаем позиции и товары склада
    const items = await procurementRepository.getItemsByComparisonId(comparisonId);
    const warehouseItems = await procurementRepository.getAllWarehouseItems();

    // Подготавливаем данные для AI
    const excelItems: ExcelItem[] = items.map(item => ({
      name: item.excel_name,
      sku: item.excel_sku || undefined,
      quantity: item.excel_quantity,
      unit: item.excel_unit || 'шт'
    }));

    // Вызываем AI для сопоставления
    const aiResult = await compareWithAI(excelItems, warehouseItems);

    // Обновляем позиции с результатами сопоставления
    let inStock = 0, partial = 0, missing = 0;

    for (const match of aiResult.matches) {
      const item = items[match.excelIndex];
      if (!item) continue;

      let status = 'missing';
      let warehouseQuantity = 0;
      let quantityToOrder = item.excel_quantity;

      if (match.warehouseItemId) {
        const warehouseItem = warehouseItems.find(w => w.id === match.warehouseItemId);
        if (warehouseItem) {
          warehouseQuantity = warehouseItem.quantity;

          if (warehouseQuantity >= item.excel_quantity) {
            status = 'in_stock';
            quantityToOrder = 0;
            inStock++;
          } else if (warehouseQuantity > 0) {
            status = 'partial';
            quantityToOrder = item.excel_quantity - warehouseQuantity;
            partial++;
          } else {
            status = 'missing';
            missing++;
          }
        } else {
          missing++;
        }
      } else {
        missing++;
      }

      // Собираем информацию об альтернативах
      const alternatives = match.alternatives
        .map(altId => {
          const alt = warehouseItems.find(w => w.id === altId);
          if (!alt) return null;
          return {
            id: alt.id,
            name: alt.name,
            sku: alt.sku,
            quantity: alt.quantity
          };
        })
        .filter(Boolean);

      await procurementRepository.updateItem(item.id, {
        warehouse_item_id: match.warehouseItemId,
        warehouse_quantity: warehouseQuantity,
        status,
        match_confidence: match.confidence,
        ai_suggestions: JSON.stringify(alternatives),
        quantity_to_order: quantityToOrder
      });
    }

    // Обновляем статистику сравнения
    const updatedComparison = await procurementRepository.updateComparison(comparisonId, {
      status: 'completed',
      items_in_stock: inStock,
      items_partial: partial,
      items_missing: missing
    });

    return updatedComparison!;
  },

  // Получить сравнение с позициями
  async getComparisonWithItems(comparisonId: string): Promise<{
    comparison: ProcurementComparison;
    items: ComparisonItemWithWarehouse[];
  } | null> {
    const comparison = await procurementRepository.getComparisonById(comparisonId);
    if (!comparison) return null;

    const items = await procurementRepository.getItemsByComparisonId(comparisonId);
    const warehouseItems = await procurementRepository.getAllWarehouseItems();
    const suppliers = await procurementRepository.getAllSuppliers();

    // Карта для учёта резервирования (item_id -> зарезервированное количество)
    const reservations = new Map<string, number>();

    // Первый проход: собираем все резервирования от выбранных позиций
    for (const item of items) {
      const effectiveItemId = item.selected_alternative_id || item.warehouse_item_id;
      if (!effectiveItemId) continue;

      const effectiveWarehouseItem = warehouseItems.find((w: any) => w.id === effectiveItemId);
      if (!effectiveWarehouseItem) continue;

      const alreadyReserved = reservations.get(effectiveItemId) || 0;
      const totalOnWarehouse = effectiveWarehouseItem.quantity;
      const available = Math.max(0, totalOnWarehouse - alreadyReserved);
      const canTake = Math.min(item.excel_quantity, available);

      reservations.set(effectiveItemId, alreadyReserved + canTake);
    }

    // Второй проход: обогащаем данными с учётом резервирования
    const enrichedItems: ComparisonItemWithWarehouse[] = items.map(item => {
      const effectiveItemId = item.selected_alternative_id || item.warehouse_item_id;

      const warehouseItem = item.warehouse_item_id
        ? warehouseItems.find((w: any) => w.id === item.warehouse_item_id)
        : null;

      const alternativeItem = item.selected_alternative_id
        ? warehouseItems.find((w: any) => w.id === item.selected_alternative_id)
        : null;

      // Рассчитываем доступное количество для этой позиции
      let availableQuantity = 0;
      let quantityToOrder = item.excel_quantity;

      if (effectiveItemId) {
        const effectiveWarehouseItem = alternativeItem || warehouseItem;
        if (effectiveWarehouseItem) {
          const totalOnWarehouse = effectiveWarehouseItem.quantity;
          const totalReserved = reservations.get(effectiveItemId) || 0;

          // Доступно для этой позиции = склад - (общее резервирование - её резервирование)
          // Её резервирование = min(нужно, было_доступно_когда_резервировали)
          // Упрощаем: показываем сколько есть на складе минус что зарезервировали другие
          const ownReservation = Math.min(item.excel_quantity, totalOnWarehouse);
          const reservedByOthers = Math.max(0, totalReserved - ownReservation);
          availableQuantity = Math.max(0, totalOnWarehouse - reservedByOthers);

          // Сколько нужно заказать
          const canTake = Math.min(item.excel_quantity, availableQuantity);
          quantityToOrder = Math.max(0, item.excel_quantity - canTake);
        }
      }

      // Парсим альтернативы и добавляем available_quantity
      let aiSuggestionsParsed: any[] = [];
      if (item.ai_suggestions) {
        try {
          const parsed = JSON.parse(item.ai_suggestions);
          aiSuggestionsParsed = parsed.map((alt: any) => {
            const altReserved = reservations.get(alt.id) || 0;
            const altTotal = alt.quantity || 0;
            return {
              ...alt,
              available_quantity: Math.max(0, altTotal - altReserved)
            };
          });
        } catch {}
      }

      // Находим поставщика
      const supplier = item.supplier_id
        ? suppliers.find(s => s.id === item.supplier_id)
        : null;

      return {
        ...item,
        warehouse_quantity: availableQuantity,
        quantity_to_order: quantityToOrder,
        warehouse_item: warehouseItem ? {
          id: warehouseItem.id,
          name: warehouseItem.name,
          sku: warehouseItem.sku || undefined,
          quantity: warehouseItem.quantity,
          unit: warehouseItem.unit || 'шт'
        } : null,
        alternative_item: alternativeItem ? {
          id: alternativeItem.id,
          name: alternativeItem.name,
          sku: alternativeItem.sku || undefined,
          quantity: alternativeItem.quantity,
          unit: alternativeItem.unit || 'шт'
        } : null,
        supplier: supplier ? {
          id: supplier.id,
          name: supplier.name,
          contact_person: supplier.contact_person || undefined,
          phone: supplier.phone || undefined
        } : null,
        ai_suggestions_parsed: aiSuggestionsParsed
      };
    });

    return { comparison, items: enrichedItems };
  },

  // Выбрать альтернативу для позиции
  async selectAlternative(itemId: string, alternativeId: string | null): Promise<ProcurementComparisonItem | null> {
    return await procurementRepository.updateItem(itemId, {
      selected_alternative_id: alternativeId,
      status: alternativeId ? 'alternative_selected' : 'missing'
    });
  },

  // Подтвердить сопоставление (установить confidence = 'high')
  async confirmMatch(itemId: string): Promise<ProcurementComparisonItem | null> {
    return await procurementRepository.updateItem(itemId, {
      match_confidence: 'high'
    });
  },

  // Изменить количество для позиции
  async updateItemQuantity(itemId: string, quantity: number): Promise<ProcurementComparisonItem | null> {
    return await procurementRepository.updateItem(itemId, {
      excel_quantity: quantity
    });
  },

  // Добавить/убрать позицию из заказа
  async toggleItemInOrder(itemId: string, addToOrder: boolean): Promise<ProcurementComparisonItem | null> {
    return await procurementRepository.updateItem(itemId, {
      added_to_order: addToOrder ? 1 : 0
    });
  },

  // Обновить данные позиции (поставщик, цена, примечание, статус закупки)
  async updateItem(itemId: string, data: {
    supplier_id?: string;
    price?: number;
    note?: string;
    procurement_status?: string;
    ordered_at?: Date;
    received_at?: Date;
  }): Promise<ProcurementComparisonItem | null> {
    const updateData: any = {};

    if (data.supplier_id !== undefined) updateData.supplier_id = data.supplier_id;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.procurement_status !== undefined) updateData.procurement_status = data.procurement_status;
    if (data.ordered_at !== undefined) updateData.ordered_at = data.ordered_at;
    if (data.received_at !== undefined) updateData.received_at = data.received_at;

    // Если нечего обновлять - возвращаем текущий item без изменений
    if (Object.keys(updateData).length === 0) {
      return await procurementRepository.getItemById(itemId);
    }

    return await procurementRepository.updateItem(itemId, updateData);
  },

  // Получить сравнения для этапа
  async getComparisonsByStage(stageId: string): Promise<ProcurementComparison[]> {
    return await procurementRepository.getComparisonsByStageId(stageId);
  },

  // Удалить сравнение
  async deleteComparison(comparisonId: string): Promise<boolean> {
    return await procurementRepository.deleteComparison(comparisonId);
  }
};
