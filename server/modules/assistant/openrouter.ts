// OpenRouter сервис для парсинга свободного текста
// Используем ТОЛЬКО для понимания сложных запросов

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash-lite';

interface ParsedDealIntent {
  type: 'deal' | 'search_client' | 'search_product' | 'unknown';
  client_name?: string;
  client_phone?: string;
  product_name?: string;
  quantity?: number;
  note?: string;
  raw_text: string;
}

/**
 * Парсит свободный текст пользователя с помощью AI
 * Вызывается ТОЛЬКО когда невозможно понять запрос локально
 */
export async function parseUserMessage(text: string): Promise<ParsedDealIntent> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.warn('[Assistant] OPENROUTER_API_KEY not set');
    return { type: 'unknown', raw_text: text };
  }

  const systemPrompt = `Ты - парсер текста для ERP системы мебельной фабрики.
Твоя задача - извлечь структурированные данные из сообщения пользователя.

Типы намерений:
- "deal" - хочет создать сделку/заказ
- "search_client" - ищет клиента
- "search_product" - ищет товар
- "unknown" - непонятно

Возвращай ТОЛЬКО JSON без markdown:
{
  "type": "deal|search_client|search_product|unknown",
  "client_name": "имя клиента или null",
  "client_phone": "телефон или null",
  "product_name": "название товара или null",
  "quantity": число или null,
  "note": "дополнительные заметки или null"
}`;

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://emerald-erp.ru',
        'X-Title': 'Emerald ERP Assistant'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Assistant] OpenRouter API error:', error);
      return { type: 'unknown', raw_text: text };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { type: 'unknown', raw_text: text };
    }

    const parsed = JSON.parse(content) as ParsedDealIntent;
    return { ...parsed, raw_text: text };
  } catch (error) {
    console.error('[Assistant] Parse error:', error);
    return { type: 'unknown', raw_text: text };
  }
}

export type { ParsedDealIntent };
