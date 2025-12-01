const { getBrowser, setupPage, dismissCookieBanner } = require('./browser');
const { analyzePageContent } = require('./pageAnalyzer');

const OPENROUTER_API_KEY = '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';
const MODEL = 'google/gemini-2.0-flash-lite-001';

// Типы страниц для полноценного многостраничного шаблона
const TEMPLATE_PAGE_TYPES = [
  {
    id: 'home',
    name: 'Главная',
    description: 'Главная страница сайта с hero-секцией',
    priority: 1,
    patterns: ['/'],
    required: true
  },
  {
    id: 'about',
    name: 'О нас / О компании',
    description: 'Страница с информацией о компании, истории, команде',
    priority: 2,
    patterns: ['/about', '/about-us', '/company', '/o-nas', '/o-kompanii'],
    required: true
  },
  {
    id: 'contacts',
    name: 'Контакты',
    description: 'Страница с контактной информацией, формой связи, картой',
    priority: 3,
    patterns: ['/contact', '/contacts', '/kontakty'],
    required: true
  },
  {
    id: 'services',
    name: 'Услуги / Каталог',
    description: 'Список услуг или товаров в виде карточек',
    priority: 4,
    patterns: ['/services', '/products', '/catalog', '/uslugi', '/katalog', '/shop'],
    required: true
  },
  {
    id: 'service_item',
    name: 'Карточка услуги',
    description: 'Детальная страница одной услуги',
    priority: 5,
    patterns: ['/services/*', '/uslugi/*'],
    required: false
  },
  {
    id: 'product_item',
    name: 'Карточка товара',
    description: 'Детальная страница одного товара с ценой, фото, описанием и кнопкой купить',
    priority: 6,
    patterns: ['/product/*', '/products/*', '/catalog/*', '/shop/*', '/tovar/*'],
    required: true
  },
  {
    id: 'blog',
    name: 'Блог / Новости',
    description: 'Список статей или новостей',
    priority: 7,
    patterns: ['/blog', '/news', '/articles', '/novosti', '/stati'],
    required: false
  },
  {
    id: 'blog_post',
    name: 'Статья блога',
    description: 'Детальная страница статьи с текстом',
    priority: 8,
    patterns: ['/blog/*', '/news/*', '/articles/*'],
    required: false
  },
  {
    id: 'portfolio',
    name: 'Портфолио / Кейсы',
    description: 'Галерея работ или проектов',
    priority: 9,
    patterns: ['/portfolio', '/works', '/projects', '/cases', '/raboty'],
    required: false
  },
  {
    id: 'pricing',
    name: 'Цены / Тарифы',
    description: 'Страница с ценами и тарифами',
    priority: 10,
    patterns: ['/pricing', '/prices', '/tariffs', '/tseny', '/tarify'],
    required: false
  },
  {
    id: 'faq',
    name: 'FAQ',
    description: 'Часто задаваемые вопросы с аккордеонами',
    priority: 11,
    patterns: ['/faq', '/questions', '/voprosy'],
    required: false
  },
  {
    id: '404',
    name: '404 - Страница не найдена',
    description: 'Страница ошибки 404',
    priority: 12,
    patterns: ['/404', '/not-found'],
    required: false
  }
];

/**
 * Классифицировать страницу через AI
 */
async function classifyPageWithAI(pageInfo, pageContext) {
  const ctx = pageContext || {};

  // Собираем контекст для AI
  const contentInfo = [];

  // Заголовки
  if (ctx.h1Text) contentInfo.push(`H1: "${ctx.h1Text}"`);
  if (ctx.headings?.length > 1) contentInfo.push(`Заголовки: ${ctx.headings.slice(0, 5).join(' | ')}`);

  // Навигация
  if (ctx.navItems?.length > 0) contentInfo.push(`Меню: ${ctx.navItems.slice(0, 8).join(' | ')}`);
  if (ctx.breadcrumbsText) contentInfo.push(`Хлебные крошки: ${ctx.breadcrumbsText}`);

  // Текст страницы
  if (ctx.mainText) contentInfo.push(`Текст: "${ctx.mainText.slice(0, 300)}..."`);

  // Признаки страницы
  const features = [];
  if (ctx.hasPrice) features.push('цена');
  if (ctx.hasAddToCart) features.push('кнопка_купить');
  if (ctx.hasProductGallery) features.push('галерея_товара');
  if (ctx.hasProductSpecs) features.push('характеристики');
  if (ctx.productCount > 0) features.push(`товаров_в_списке:${ctx.productCount}`);
  if (ctx.hasContactForm) features.push('форма_связи');
  if (ctx.hasMap) features.push('карта');
  if (ctx.hasPhoneNumber) features.push('телефон');
  if (ctx.hasAddress) features.push('адрес');
  if (ctx.hasTeamSection) features.push('секция_команды');
  if (ctx.hasFaqSection) features.push('FAQ_аккордеон');
  if (ctx.hasPriceTable) features.push('таблица_цен');
  if (ctx.hasPortfolioGallery) features.push('галерея_работ');
  if (ctx.hasArticleBody) features.push('длинный_текст_статьи');
  if (ctx.hasTestimonials) features.push('отзывы');

  const prompt = `Определи тип страницы по КОНТЕНТУ (игнорируй URL, он может быть любым).

КОНТЕНТ СТРАНИЦЫ:
${contentInfo.join('\n')}

ПРИЗНАКИ: ${features.join(', ') || 'нет особых признаков'}

ТИПЫ СТРАНИЦ:
- home: Главная страница (путь "/" или hero-секция)
- about: О нас/О компании (информация о компании, история, секция команды)
- contacts: Контакты (форма связи, карта, телефон, адрес)
- services: Каталог/Услуги (список карточек товаров или услуг, productCount > 3)
- product_item: Карточка товара (ОДИН товар с ценой и кнопкой купить)
- service_item: Карточка услуги (детальная страница одной услуги)
- blog: Блог/Новости (список статей)
- blog_post: Статья (длинный текст статьи)
- portfolio: Портфолио (галерея работ/проектов)
- pricing: Цены/Тарифы (таблица цен)
- faq: FAQ (аккордеон вопросов-ответов)
- none: не подходит ни под один тип

ПРИМЕРЫ:
- URL=/team но H1="Наша команда" и hasTeamSection → about
- URL=/p/123 но hasPrice и hasAddToCart → product_item
- URL=/voprosy но hasFaqSection → faq
- hasContactForm и hasMap → contacts

Ответь ТОЛЬКО id типа: home, about, contacts, services, product_item, service_item, blog, blog_post, portfolio, pricing, faq, none`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3500',
        'X-Title': 'ScreenCreate Template Finder'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 20,
        temperature: 0
      })
    });

    if (!response.ok) {
      console.error('OpenRouter API error:', await response.text());
      return null;
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim().toLowerCase() || '';

    // Найти тип по id
    const pageType = TEMPLATE_PAGE_TYPES.find(t => answer.includes(t.id));

    console.log(`[AI Classify] ${pageInfo.pathname} => ${answer} => ${pageType?.id || 'none'}`);

    return pageType?.id || null;
  } catch (error) {
    console.error('AI classification error:', error.message);
    return null;
  }
}

/**
 * Найти страницы для шаблона на сайте
 */
async function findTemplatePages(startUrl, options = {}) {
  const { onProgress = null, maxPagesToCheck = 50 } = options;

  const baseUrl = new URL(startUrl);
  const visited = new Set();
  const queue = [startUrl];
  const foundPages = new Map(); // pageType => pageInfo

  const browserInstance = await getBrowser();

  if (onProgress) {
    onProgress({ type: 'start', message: 'Начинаю поиск страниц для шаблона...' });
  }

  let checkedCount = 0;

  while (queue.length > 0 && checkedCount < maxPagesToCheck) {
    const url = queue.shift();
    const normalizedUrl = normalizeUrl(url);

    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);

    checkedCount++;

    try {
      const page = await browserInstance.newPage();
      await setupPage(page);
      await page.setViewport({ width: 1920, height: 1080 });

      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      const statusCode = response?.status() || 200;

      await dismissCookieBanner(page);

      const title = await page.title();
      const pathname = new URL(url).pathname;

      const pageInfo = {
        url,
        pathname,
        title,
        statusCode
      };

      if (onProgress) {
        onProgress({
          type: 'checking',
          url,
          pathname,
          checked: checkedCount,
          queued: queue.length,
          found: foundPages.size
        });
      }

      // Проверка 404
      if (statusCode === 404 || title.toLowerCase().includes('404') || title.toLowerCase().includes('not found')) {
        if (!foundPages.has('404')) {
          foundPages.set('404', { ...pageInfo, pageType: '404' });
          if (onProgress) {
            onProgress({ type: 'found', pageType: '404', page: pageInfo });
          }
        }
      } else {
        // Анализируем контент страницы
        const pageContext = await analyzePageContent(page);

        // Классифицируем через AI
        const pageType = await classifyPageWithAI(pageInfo, pageContext);

        if (pageType && !foundPages.has(pageType)) {
          foundPages.set(pageType, { ...pageInfo, pageType, context: pageContext });
          if (onProgress) {
            onProgress({ type: 'found', pageType, page: pageInfo });
          }
        }
      }

      // Собираем ссылки для дальнейшего обхода
      const links = await page.evaluate((baseHost) => {
        const anchors = document.querySelectorAll('a[href]');
        const urls = [];

        anchors.forEach(a => {
          try {
            const href = a.href;
            if (!href) return;

            const linkUrl = new URL(href);
            if (linkUrl.hostname !== baseHost) return;
            if (linkUrl.hash && linkUrl.pathname === window.location.pathname) return;
            if (href.match(/\.(pdf|zip|jpg|jpeg|png|gif|svg|mp4|mp3|doc|docx|xls|xlsx)$/i)) return;
            if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

            urls.push(linkUrl.origin + linkUrl.pathname);
          } catch (e) {}
        });

        return [...new Set(urls)];
      }, baseUrl.hostname);

      for (const link of links) {
        const normalized = normalizeUrl(link);
        if (!visited.has(normalized) && !queue.includes(link)) {
          queue.push(link);
        }
      }

      await page.close();

      // Проверяем, нашли ли все обязательные типы
      const requiredTypes = TEMPLATE_PAGE_TYPES.filter(t => t.required).map(t => t.id);
      const foundRequired = requiredTypes.filter(t => foundPages.has(t));

      if (foundRequired.length === requiredTypes.length) {
        if (onProgress) {
          onProgress({ type: 'all_required_found', message: 'Все обязательные страницы найдены!' });
        }
        // Продолжаем искать опциональные, но можем остановиться раньше
        if (foundPages.size >= 8) break;
      }

    } catch (error) {
      console.error(`Error checking ${url}:`, error.message);
      if (onProgress) {
        onProgress({ type: 'error', url, error: error.message });
      }
    }
  }

  // Попробуем найти 404 если ещё не нашли
  if (!foundPages.has('404')) {
    try {
      const page = await browserInstance.newPage();
      await setupPage(page);
      const notFoundUrl = `${baseUrl.origin}/this-page-does-not-exist-404-test`;
      await page.goto(notFoundUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      const title = await page.title();

      foundPages.set('404', {
        url: notFoundUrl,
        pathname: '/404',
        title,
        pageType: '404'
      });

      if (onProgress) {
        onProgress({ type: 'found', pageType: '404', page: { url: notFoundUrl, title } });
      }

      await page.close();
    } catch (e) {
      console.log('Could not capture 404 page');
    }
  }

  // Формируем результат с информацией о типах
  const result = {
    site: baseUrl.hostname,
    startUrl,
    checkedPages: checkedCount,
    foundPages: Array.from(foundPages.values()).map(p => {
      const typeInfo = TEMPLATE_PAGE_TYPES.find(t => t.id === p.pageType);
      return {
        ...p,
        typeName: typeInfo?.name || p.pageType,
        typeDescription: typeInfo?.description || '',
        required: typeInfo?.required || false
      };
    }).sort((a, b) => {
      const aPriority = TEMPLATE_PAGE_TYPES.find(t => t.id === a.pageType)?.priority || 99;
      const bPriority = TEMPLATE_PAGE_TYPES.find(t => t.id === b.pageType)?.priority || 99;
      return aPriority - bPriority;
    }),
    missingRequired: TEMPLATE_PAGE_TYPES
      .filter(t => t.required && !foundPages.has(t.id))
      .map(t => ({ id: t.id, name: t.name })),
    pageTypes: TEMPLATE_PAGE_TYPES
  };

  if (onProgress) {
    onProgress({ type: 'complete', result });
  }

  return result;
}

function normalizeUrl(url) {
  const u = new URL(url);
  let pathname = u.pathname;
  if (pathname !== '/' && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  return u.hostname + pathname;
}

module.exports = {
  findTemplatePages,
  TEMPLATE_PAGE_TYPES
};
