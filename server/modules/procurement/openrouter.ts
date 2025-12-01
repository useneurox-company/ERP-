// OpenRouter сервис для AI сопоставления закупок
// Используем Gemini Flash 1.5 - самая дешёвая модель

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-lite'; // Быстрая и дешёвая модель

interface WarehouseItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  unit?: string;
}

interface ExcelItem {
  name: string;
  sku?: string;
  quantity: number;
  unit?: string;
}

interface AiMatch {
  excelIndex: number;
  excelName: string;
  warehouseItemId: string | null;
  confidence: 'high' | 'medium' | 'low';
  alternatives: string[]; // массив id альтернатив
  reason: string;
}

interface ComparisonResult {
  matches: AiMatch[];
}

export async function compareWithAI(
  excelItems: ExcelItem[],
  warehouseItems: WarehouseItem[]
): Promise<ComparisonResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not set, using fallback matching');
    return fallbackMatching(excelItems, warehouseItems);
  }

  const systemPrompt = `Ты - эксперт по сопоставлению товаров для мебельного производства.
Твоя задача - сопоставить позиции из Excel с товарами на складе.

Правила сопоставления:
1. Точное совпадение по артикулу (SKU) = confidence: "high"
2. Похожее название (синонимы, вариации) = confidence: "medium"
3. Возможная альтернатива = confidence: "low"
4. Если совпадения нет - warehouseItemId: null, предложи похожие альтернативы

ВАЖНО: Возвращай ТОЛЬКО валидный JSON без markdown разметки!`;

  const userPrompt = `Сопоставь позиции из Excel с товарами склада.

Позиции из Excel:
${JSON.stringify(excelItems.map((item, idx) => ({ index: idx, ...item })), null, 2)}

Товары на складе:
${JSON.stringify(warehouseItems.map(item => ({ id: item.id, name: item.name, sku: item.sku, quantity: item.quantity })), null, 2)}

Верни JSON в формате:
{
  "matches": [
    {
      "excelIndex": 0,
      "excelName": "название из Excel",
      "warehouseItemId": "id товара или null",
      "confidence": "high|medium|low",
      "alternatives": ["id1", "id2"],
      "reason": "причина выбора"
    }
  ]
}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://emerald-erp.ru',
        'X-Title': 'Emerald ERP Procurement'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1, // низкая температура для точности
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter API error:', error);
      return fallbackMatching(excelItems, warehouseItems);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('Empty response from OpenRouter');
      return fallbackMatching(excelItems, warehouseItems);
    }

    // Парсим JSON ответ
    const result = JSON.parse(content) as ComparisonResult;
    return result;
  } catch (error) {
    console.error('OpenRouter error:', error);
    return fallbackMatching(excelItems, warehouseItems);
  }
}

// Fallback сопоставление без AI (по точному совпадению SKU и названия)
function fallbackMatching(
  excelItems: ExcelItem[],
  warehouseItems: WarehouseItem[]
): ComparisonResult {
  const matches: AiMatch[] = excelItems.map((excel, index) => {
    // Ищем по SKU
    if (excel.sku) {
      const skuMatch = warehouseItems.find(w =>
        w.sku?.toLowerCase() === excel.sku?.toLowerCase()
      );
      if (skuMatch) {
        return {
          excelIndex: index,
          excelName: excel.name,
          warehouseItemId: skuMatch.id,
          confidence: 'high' as const,
          alternatives: [],
          reason: 'Точное совпадение по артикулу'
        };
      }
    }

    // Ищем по названию (нечёткое)
    const nameLower = excel.name.toLowerCase();
    const nameMatch = warehouseItems.find(w =>
      w.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(w.name.toLowerCase())
    );

    if (nameMatch) {
      return {
        excelIndex: index,
        excelName: excel.name,
        warehouseItemId: nameMatch.id,
        confidence: 'medium' as const,
        alternatives: [],
        reason: 'Похожее название'
      };
    }

    // Ищем альтернативы по ключевым словам
    const keywords = nameLower.split(/\s+/).filter(w => w.length > 3);
    const alternatives = warehouseItems
      .filter(w => keywords.some(kw => w.name.toLowerCase().includes(kw)))
      .slice(0, 3)
      .map(w => w.id);

    return {
      excelIndex: index,
      excelName: excel.name,
      warehouseItemId: null,
      confidence: 'low' as const,
      alternatives,
      reason: alternatives.length > 0 ? 'Найдены возможные альтернативы' : 'Совпадений не найдено'
    };
  });

  return { matches };
}

/**
 * Парсит Excel данные с помощью AI для извлечения товаров
 */
export async function parseExcelWithAI(rawData: any[][]): Promise<{
  items: Array<{
    name: string;
    sku?: string;
    quantity: number;
    unit: string;
  }>;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('[Excel Parser] OPENROUTER_API_KEY not set, using fallback');
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Берём все строки для анализа (до 500 строк отправляем в AI)
  const AI_ROW_LIMIT = 500;
  const sampleData = rawData.slice(0, Math.min(AI_ROW_LIMIT, rawData.length));

  // Форматируем данные для AI
  const formattedData = sampleData.map((row, idx) =>
    `Row ${idx}: [${(row || []).map(cell => cell === undefined || cell === null ? '' : String(cell)).join(' | ')}]`
  ).join('\n');

  const systemPrompt = `Ты - эксперт по анализу Excel файлов с товарами/материалами.

Твоя задача: проанализировать данные из Excel и извлечь список товаров с наименованиями, артикулами и количеством.

ПРАВИЛА:
1. Найди строку с заголовками (обычно содержит слова типа "Наименование", "Название", "Количество", "Артикул", "Кол-во" и т.д.)
2. Данные о товарах находятся ПОСЛЕ строки с заголовками
3. Игнорируй служебные строки (заголовок документа, дата, итого и т.д.)
4. Если количество не указано или некорректно - ставь 1
5. Если единица измерения не указана - ставь "шт"
6. Артикул может отсутствовать - это нормально

ФОРМАТ ОТВЕТА (только JSON, без markdown):
{
  "header_row_index": число,
  "items": [
    {"name": "Название товара", "sku": "артикул или null", "quantity": число, "unit": "шт"}
  ]
}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://emerald-erp.ru',
        'X-Title': 'Emerald ERP Excel Parser'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Проанализируй эти данные из Excel файла и извлеки список товаров:\n\n${formattedData}\n\nВерни JSON с найденными товарами.`
          }
        ],
        temperature: 0.1,
        max_tokens: 16384,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Excel Parser] OpenRouter API error:', error);
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from OpenRouter');
    }

    console.log('[Excel Parser] AI response:', content);
    const parsed = JSON.parse(content);

    // Если файл больше AI_ROW_LIMIT строк, обрабатываем остальные по найденной структуре
    if (rawData.length > AI_ROW_LIMIT && parsed.header_row_index !== undefined) {
      const headerIdx = parsed.header_row_index;
      const headers = rawData[headerIdx] || [];

      let nameIdx = -1, skuIdx = -1, qtyIdx = -1, unitIdx = -1;

      headers.forEach((h: any, i: number) => {
        const hLower = String(h || '').toLowerCase();
        if (nameIdx === -1 && (hLower.includes('наимен') || hLower.includes('назван') || hLower.includes('товар') || hLower.includes('материал') || hLower.includes('позици') || hLower === 'name')) {
          nameIdx = i;
        }
        if (skuIdx === -1 && (hLower.includes('артикул') || hLower.includes('арт') || hLower.includes('sku') || hLower.includes('код'))) {
          skuIdx = i;
        }
        if (qtyIdx === -1 && (hLower.includes('кол') || hLower.includes('qty') || hLower.includes('quantity') || hLower.includes('шт'))) {
          qtyIdx = i;
        }
        if (unitIdx === -1 && (hLower.includes('ед') || hLower.includes('unit'))) {
          unitIdx = i;
        }
      });

      if (nameIdx === -1) nameIdx = 0;

      const additionalItems: any[] = [];
      for (let i = AI_ROW_LIMIT; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const name = row[nameIdx];
        if (!name || String(name).trim() === '') continue;

        const nameLower = String(name).toLowerCase();
        if (nameLower.includes('итого') || nameLower.includes('всего') || nameLower.includes('total')) continue;

        additionalItems.push({
          name: String(name).trim(),
          sku: skuIdx >= 0 && row[skuIdx] ? String(row[skuIdx]).trim() : null,
          quantity: qtyIdx >= 0 && row[qtyIdx] ? (parseFloat(row[qtyIdx]) || 1) : 1,
          unit: unitIdx >= 0 && row[unitIdx] ? String(row[unitIdx]).trim() : 'шт'
        });
      }

      parsed.items = [...(parsed.items || []), ...additionalItems];
    }

    console.log(`[Excel Parser] Extracted ${parsed.items?.length || 0} items`);

    return {
      items: (parsed.items || []).filter((item: any) => item.name && item.name.trim())
    };
  } catch (error) {
    console.error('[Excel Parser] Error:', error);
    throw error;
  }
}

export type { AiMatch, ComparisonResult, ExcelItem, WarehouseItem };
