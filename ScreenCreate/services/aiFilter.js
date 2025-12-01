const OPENROUTER_API_KEY = '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';
const MODEL = 'google/gemini-2.0-flash-lite-001';

/**
 * Build context string from page analysis
 */
function buildContextString(ctx) {
  if (!ctx) return 'Контекст страницы недоступен';

  const lines = [];

  // Product indicators
  if (ctx.hasPrice) lines.push(`- Цена на странице: ДА (${ctx.priceText || 'найдена'})`);
  else lines.push('- Цена на странице: НЕТ');

  lines.push(`- Кнопка "Купить/В корзину": ${ctx.hasAddToCart ? 'ДА' : 'НЕТ'}`);
  lines.push(`- Галерея фото товара: ${ctx.hasProductGallery ? 'ДА' : 'НЕТ'}`);
  lines.push(`- Характеристики товара: ${ctx.hasProductSpecs ? 'ДА' : 'НЕТ'}`);

  // Catalog indicators
  if (ctx.productCount > 0) {
    lines.push(`- Количество товаров в списке: ${ctx.productCount}`);
  }
  lines.push(`- Фильтры товаров: ${ctx.hasFilters ? 'ДА' : 'НЕТ'}`);
  lines.push(`- Пагинация: ${ctx.hasPagination ? 'ДА' : 'НЕТ'}`);

  // Contact indicators
  lines.push(`- Форма обратной связи: ${ctx.hasContactForm ? 'ДА' : 'НЕТ'}`);
  lines.push(`- Карта: ${ctx.hasMap ? 'ДА' : 'НЕТ'}`);
  lines.push(`- Номер телефона: ${ctx.hasPhoneNumber ? 'ДА' : 'НЕТ'}`);
  lines.push(`- Адрес: ${ctx.hasAddress ? 'ДА' : 'НЕТ'}`);

  // Meta
  if (ctx.schemaType) lines.push(`- Schema.org тип: ${ctx.schemaType}`);
  if (ctx.jsonLdType) lines.push(`- JSON-LD тип: ${ctx.jsonLdType}`);
  if (ctx.ogType) lines.push(`- Open Graph тип: ${ctx.ogType}`);

  // Navigation
  lines.push(`- Главная страница: ${ctx.isHomePage ? 'ДА' : 'НЕТ'}`);
  if (ctx.breadcrumbsText) lines.push(`- Хлебные крошки: ${ctx.breadcrumbsText}`);
  if (ctx.h1Text) lines.push(`- Заголовок H1: ${ctx.h1Text}`);

  return lines.join('\n');
}

/**
 * Ask AI whether to screenshot this page based on user's criteria
 * @param {string} userCriteria - What user wants, e.g. "только карточки товаров"
 * @param {object} pageInfo - { url, pathname, title, pageContext }
 * @returns {Promise<boolean>} - true if should screenshot
 */
async function shouldScreenshotPage(userCriteria, pageInfo) {
  const contextString = buildContextString(pageInfo.pageContext);

  const prompt = `Ты эксперт по анализу веб-страниц. Определи, соответствует ли страница критерию пользователя.

КРИТЕРИЙ ПОЛЬЗОВАТЕЛЯ: "${userCriteria}"

ИНФОРМАЦИЯ О СТРАНИЦЕ:
- URL: ${pageInfo.url}
- Путь: ${pageInfo.pathname}
- Заголовок: ${pageInfo.title}

АНАЛИЗ СОДЕРЖИМОГО СТРАНИЦЫ:
${contextString}

ИНСТРУКЦИИ:
- "карточка товара" = страница ОДНОГО товара с ценой и кнопкой купить, НЕ каталог
- "каталог/список товаров" = страница с НЕСКОЛЬКИМИ товарами (productCount > 3)
- "контакты" = страница с формой связи, картой или адресом
- "главная" = pathname = "/" и isHomePage = ДА

ВОПРОС: Соответствует ли эта страница критерию "${userCriteria}"?

Ответь ТОЛЬКО: ДА или НЕТ`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3500',
        'X-Title': 'ScreenCreate Crawler'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'user', content: prompt }
        ],
        max_tokens: 10,
        temperature: 0
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter API error:', error);
      return true; // On error, include the page
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase() || '';

    // Detailed logging
    console.log(`\n=== AI FILTER ===`);
    console.log(`URL: ${pageInfo.pathname}`);
    console.log(`Title: ${pageInfo.title}`);
    console.log(`Criteria: "${userCriteria}"`);
    console.log(`Context: ${contextString.split('\n').slice(0, 5).join(', ')}`);
    console.log(`AI answer: "${answer}"`);
    console.log(`Decision: ${answer.includes('ДА') || answer.includes('YES') ? 'SCREENSHOT' : 'SKIP'}`);
    if (data.usage) {
      console.log(`Tokens: prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens}`);
    }
    console.log(`=================\n`);

    return answer.includes('ДА') || answer.includes('YES') || answer.includes('DA');
  } catch (error) {
    console.error('AI filter error:', error.message);
    return true; // On error, include the page
  }
}

/**
 * Batch check multiple pages (more efficient)
 */
async function shouldScreenshotPages(userCriteria, pagesInfo) {
  const results = await Promise.all(
    pagesInfo.map(page => shouldScreenshotPage(userCriteria, page))
  );
  return results;
}

module.exports = {
  shouldScreenshotPage,
  shouldScreenshotPages
};
