import OpenAI from "openai";
import { aiRepository } from "./repository";
import type { InsertAiChatMessage, InsertAiCorrection } from "@shared/schema";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

if (!openai) {
  console.warn("⚠️  WARNING: OPENAI_API_KEY is not set. AI features will be disabled.");
}

const SYSTEM_PROMPT = `Вы - эксперт по расчёту мебели и созданию коммерческих предложений.

Ваша задача:
1. Анализировать чертежи и эскизы мебели
2. Определять материалы, размеры, количество элементов
3. Рассчитывать стоимость на основе прайс-листа материалов
4. Создавать детализированные коммерческие предложения

Формат ответа для расчёта:
{
  "items": [
    {
      "name": "Название изделия",
      "description": "Описание",
      "materials": [
        {"name": "Материал", "quantity": число, "unit": "единица", "price": число}
      ],
      "labor": число,
      "total": число
    }
  ],
  "totalCost": число,
  "notes": "Дополнительные заметки"
}

Используйте предыдущие корректировки для улучшения точности расчётов.`;

export class AiService {
  async analyzePdf(base64Pdf: string, dealId: string, userId: string, userMessage?: string) {
    if (!openai) {
      throw new Error("AI service is not available. Please configure OPENAI_API_KEY.");
    }

    const corrections = await aiRepository.getCorrections(dealId);
    const materials = await aiRepository.getMaterialPrices();
    
    const materialContext = materials.length > 0 
      ? `\n\nПрайс-лист материалов:\n${materials.map(m => `${m.name}: ${m.price} руб/${m.unit}`).join('\n')}`
      : '';
    
    const correctionContext = corrections.length > 0
      ? `\n\nПредыдущие корректировки:\n${corrections.slice(0, 5).map(c => 
          `- ${c.correction_type}: ${c.corrected_data}`
        ).join('\n')}`
      : '';

    const pdfBuffer = Buffer.from(base64Pdf, 'base64');
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + materialContext + correctionContext },
      {
        role: "user",
        content: `${userMessage || "Проанализируйте чертёж и создайте расчёт КП"}. Верните результат в формате JSON.\n\nТекст из PDF документа:\n${pdfText}`
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const result = response.choices[0].message.content;
    
    await aiRepository.createChatMessage({
      deal_id: dealId,
      user_id: userId,
      role: "assistant",
      content: result,
    });

    return JSON.parse(result);
  }

  async chat(dealId: string, userId: string, message: string) {
    if (!openai) {
      throw new Error("AI service is not available. Please configure OPENAI_API_KEY.");
    }

    await aiRepository.createChatMessage({
      deal_id: dealId,
      user_id: userId,
      role: "user",
      content: message,
    });

    const history = await aiRepository.getChatMessages(dealId);
    const corrections = await aiRepository.getCorrections(dealId);
    const materials = await aiRepository.getMaterialPrices();
    
    const materialContext = materials.length > 0 
      ? `\n\nПрайс-лист материалов:\n${materials.map(m => `${m.name}: ${m.price} руб/${m.unit}`).join('\n')}`
      : '';
    
    const correctionContext = corrections.length > 0
      ? `\n\nПредыдущие корректировки:\n${corrections.slice(0, 10).map(c => 
          `- ${c.correction_type}: ${c.corrected_data}`
        ).join('\n')}`
      : '';

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT + materialContext + correctionContext },
      ...history.slice(-10).map(m => ({ role: m.role, content: m.content }))
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      max_completion_tokens: 2048,
    });

    const assistantMessage = response.choices[0].message.content;
    
    await aiRepository.createChatMessage({
      deal_id: dealId,
      user_id: userId,
      role: "assistant",
      content: assistantMessage,
    });

    return { message: assistantMessage, history: await aiRepository.getChatMessages(dealId) };
  }

  async saveCorrection(data: InsertAiCorrection) {
    return await aiRepository.createCorrection(data);
  }

  async getChatHistory(dealId: string) {
    return await aiRepository.getChatMessages(dealId);
  }

  async getMaterialPrices() {
    return await aiRepository.getMaterialPrices();
  }

  /**
   * Парсит Excel файл с помощью AI для извлечения данных о товарах
   * AI сам определяет где находятся наименования, артикулы и количества
   */
  async parseExcelWithAI(excelData: any[][]): Promise<{
    items: Array<{
      name: string;
      sku?: string;
      quantity: number;
      unit: string;
    }>;
  }> {
    if (!openai) {
      throw new Error("AI service is not available. Please configure OPENAI_API_KEY.");
    }

    // Берём первые 50 строк для анализа (достаточно для определения структуры)
    const sampleData = excelData.slice(0, Math.min(50, excelData.length));

    // Форматируем данные для AI
    const formattedData = sampleData.map((row, idx) =>
      `Row ${idx}: [${row.map(cell => cell === undefined || cell === null ? '' : String(cell)).join(' | ')}]`
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Проанализируй эти данные из Excel файла и извлеки список товаров:\n\n${formattedData}\n\nВерни JSON с найденными товарами.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.1,
    });

    const result = response.choices[0].message.content;
    console.log('[AI Excel Parser] Raw response:', result);

    const parsed = JSON.parse(result || '{"items": []}');

    // Если AI нашёл только часть данных (50 строк), нужно обработать остальные
    // используя найденную структуру
    if (excelData.length > 50 && parsed.header_row_index !== undefined) {
      const headerIdx = parsed.header_row_index;
      const headers = excelData[headerIdx] || [];

      // Определяем индексы колонок на основе заголовков
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

      // Если не нашли колонку названия, берём первую
      if (nameIdx === -1) nameIdx = 0;

      // Обрабатываем остальные строки
      const additionalItems: any[] = [];
      for (let i = 50; i < excelData.length; i++) {
        const row = excelData[i];
        if (!row || row.length === 0) continue;

        const name = row[nameIdx];
        if (!name || String(name).trim() === '') continue;

        // Пропускаем итоговые строки
        const nameLower = String(name).toLowerCase();
        if (nameLower.includes('итого') || nameLower.includes('всего') || nameLower.includes('total')) continue;

        additionalItems.push({
          name: String(name).trim(),
          sku: skuIdx >= 0 && row[skuIdx] ? String(row[skuIdx]).trim() : null,
          quantity: qtyIdx >= 0 && row[qtyIdx] ? (parseFloat(row[qtyIdx]) || 1) : 1,
          unit: unitIdx >= 0 && row[unitIdx] ? String(row[unitIdx]).trim() : 'шт'
        });
      }

      parsed.items = [...parsed.items, ...additionalItems];
    }

    console.log(`[AI Excel Parser] Extracted ${parsed.items?.length || 0} items`);

    return {
      items: (parsed.items || []).filter((item: any) => item.name && item.name.trim())
    };
  }
}

export const aiService = new AiService();
