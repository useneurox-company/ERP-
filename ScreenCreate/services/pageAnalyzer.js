/**
 * Page Content Analyzer
 * Extracts structured data from page to help AI make better decisions
 */

async function analyzePageContent(page) {
  return await page.evaluate(() => {
    // Helper: get text content safely
    const getText = (selector) => {
      const el = document.querySelector(selector);
      return el ? el.textContent.trim() : null;
    };

    // Helper: check if element exists
    const exists = (selector) => !!document.querySelector(selector);

    // Helper: count elements
    const count = (selector) => document.querySelectorAll(selector).length;

    // ===== PRODUCT PAGE INDICATORS =====

    // Price detection (various formats)
    const priceSelectors = [
      '[class*="price"]',
      '[class*="Price"]',
      '[itemprop="price"]',
      '[data-price]',
      '.product-price',
      '.item-price',
      '#price',
      '[class*="cost"]',
      '[class*="Cost"]'
    ];
    const priceElement = priceSelectors.map(s => document.querySelector(s)).find(el => el);
    const hasPrice = !!priceElement;
    const priceText = priceElement ? priceElement.textContent.trim().slice(0, 50) : null;

    // Add to cart button detection
    const cartSelectors = [
      'button[class*="cart"]',
      'button[class*="Cart"]',
      'button[class*="buy"]',
      'button[class*="Buy"]',
      'button[class*="basket"]',
      'button[class*="Basket"]',
      '[class*="add-to-cart"]',
      '[class*="addToCart"]',
      '[class*="add_to_cart"]',
      'button[class*="purchase"]',
      '[data-action*="cart"]',
      '[data-action*="buy"]',
      'a[class*="buy"]',
      'a[class*="cart"]'
    ];
    const hasAddToCart = cartSelectors.some(s => {
      const el = document.querySelector(s);
      if (!el) return false;
      const text = el.textContent.toLowerCase();
      return text.includes('корзин') || text.includes('купить') || text.includes('cart') ||
             text.includes('buy') || text.includes('заказ') || text.includes('добавить');
    });

    // Product gallery detection
    const gallerySelectors = [
      '[class*="gallery"] img',
      '[class*="Gallery"] img',
      '[class*="slider"] img',
      '[class*="Slider"] img',
      '[class*="carousel"] img',
      '[class*="product-image"] img',
      '[class*="product-photo"] img',
      '.swiper img',
      '[class*="thumbs"] img'
    ];
    const galleryImages = gallerySelectors.reduce((acc, s) => acc + count(s), 0);
    const hasProductGallery = galleryImages > 2;

    // Product specifications
    const specsSelectors = [
      '[class*="specifications"]',
      '[class*="characteristics"]',
      '[class*="specs"]',
      '[class*="features"]',
      '[class*="params"]',
      'table[class*="product"]',
      '[itemprop="description"]'
    ];
    const hasProductSpecs = specsSelectors.some(s => exists(s));

    // ===== CATALOG/LISTING PAGE INDICATORS =====

    const catalogSelectors = [
      '[class*="product-card"]',
      '[class*="product-item"]',
      '[class*="catalog-item"]',
      '[class*="goods-item"]',
      '[class*="item-card"]',
      '[class*="ProductCard"]',
      '[class*="product_card"]',
      '[data-product-id]',
      '[data-item-id]',
      '.product',
      '[itemtype*="Product"]'
    ];
    const productCount = catalogSelectors.reduce((max, s) => Math.max(max, count(s)), 0);

    // Filters detection
    const filterSelectors = [
      '[class*="filter"]',
      '[class*="Filter"]',
      '[class*="facet"]',
      '[class*="sidebar"] input[type="checkbox"]',
      '[class*="sort"]'
    ];
    const hasFilters = filterSelectors.some(s => exists(s));

    // Pagination detection
    const paginationSelectors = [
      '[class*="pagination"]',
      '[class*="Pagination"]',
      '[class*="pager"]',
      '.page-numbers',
      '[class*="page-link"]'
    ];
    const hasPagination = paginationSelectors.some(s => exists(s));

    // ===== CONTACT PAGE INDICATORS =====

    // Contact form
    const hasContactForm = exists('form[class*="contact"]') ||
                          exists('form[class*="feedback"]') ||
                          exists('form[action*="contact"]') ||
                          exists('[class*="contact-form"]');

    // Map (Google Maps, Yandex Maps, etc.)
    const hasMap = exists('[class*="map"]') ||
                  exists('iframe[src*="maps"]') ||
                  exists('iframe[src*="yandex"]') ||
                  exists('#map') ||
                  exists('.ymaps');

    // Phone numbers
    const phoneRegex = /(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/;
    const bodyText = document.body.textContent;
    const hasPhoneNumber = phoneRegex.test(bodyText);

    // Address
    const hasAddress = exists('[itemprop="address"]') ||
                      exists('[class*="address"]') ||
                      exists('[class*="Address"]');

    // ===== META DATA =====

    const metaDescription = document.querySelector('meta[name="description"]')?.content || null;
    const ogType = document.querySelector('meta[property="og:type"]')?.content || null;

    // Schema.org type
    const schemaElement = document.querySelector('[itemtype]');
    const schemaType = schemaElement ? schemaElement.getAttribute('itemtype').split('/').pop() : null;

    // JSON-LD structured data
    let jsonLdType = null;
    const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
    if (jsonLdScript) {
      try {
        const data = JSON.parse(jsonLdScript.textContent);
        jsonLdType = data['@type'] || (Array.isArray(data) ? data[0]?.['@type'] : null);
      } catch (e) {}
    }

    // Breadcrumbs
    const breadcrumbsSelectors = [
      '[class*="breadcrumb"]',
      '[class*="Breadcrumb"]',
      '[itemtype*="BreadcrumbList"]',
      '.crumbs'
    ];
    const breadcrumbsEl = breadcrumbsSelectors.map(s => document.querySelector(s)).find(el => el);
    const hasBreadcrumbs = !!breadcrumbsEl;
    const breadcrumbsText = breadcrumbsEl ? breadcrumbsEl.textContent.replace(/\s+/g, ' ').trim().slice(0, 100) : null;

    // ===== PAGE TYPE HINTS =====

    const h1Text = getText('h1');
    const isHomePage = window.location.pathname === '/' || window.location.pathname === '';

    // ===== NAVIGATION MENU =====
    const navSelectors = ['nav', 'header', '[class*="menu"]', '[class*="nav"]'];
    const navItems = [];
    for (const selector of navSelectors) {
      const nav = document.querySelector(selector);
      if (nav) {
        const links = nav.querySelectorAll('a');
        links.forEach(a => {
          const text = a.textContent.trim();
          if (text && text.length < 30 && !text.includes('\n')) {
            navItems.push(text);
          }
        });
        if (navItems.length > 0) break;
      }
    }

    // ===== ALL HEADINGS H1-H3 =====
    const headings = [];
    document.querySelectorAll('h1, h2, h3').forEach(h => {
      const text = h.textContent.trim().slice(0, 80);
      if (text && !headings.includes(text)) {
        headings.push(text);
      }
    });

    // ===== MAIN TEXT CONTENT =====
    const mainSelectors = ['main', 'article', '[class*="content"]', '[class*="body"]', '.container'];
    let mainText = '';
    for (const selector of mainSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        mainText = el.textContent.replace(/\s+/g, ' ').trim().slice(0, 500);
        if (mainText.length > 100) break;
      }
    }
    if (!mainText) {
      mainText = document.body.textContent.replace(/\s+/g, ' ').trim().slice(0, 500);
    }

    // ===== SECTION TYPE INDICATORS =====

    // Team section (photos with names)
    const hasTeamSection = exists('[class*="team"]') ||
                          exists('[class*="Team"]') ||
                          exists('[class*="staff"]') ||
                          exists('[class*="employees"]') ||
                          exists('[class*="komanda"]') ||
                          (count('[class*="member"]') > 2 && count('[class*="member"] img') > 2);

    // FAQ section (accordion/questions)
    const hasFaqSection = exists('[class*="faq"]') ||
                         exists('[class*="FAQ"]') ||
                         exists('[class*="accordion"]') ||
                         exists('[class*="questions"]') ||
                         exists('[class*="voprosy"]') ||
                         exists('details summary');

    // Price/tariff table
    const hasPriceTable = exists('[class*="pricing"]') ||
                         exists('[class*="tariff"]') ||
                         exists('[class*="price-table"]') ||
                         exists('[class*="plans"]') ||
                         exists('[class*="tseny"]') ||
                         (count('table') > 0 && bodyText.match(/\d+\s*(₽|руб|usd|\$|€)/i));

    // Portfolio/works gallery
    const hasPortfolioGallery = exists('[class*="portfolio"]') ||
                               exists('[class*="works"]') ||
                               exists('[class*="projects"]') ||
                               exists('[class*="cases"]') ||
                               exists('[class*="raboty"]') ||
                               exists('[class*="gallery"]');

    // Article body (long text content)
    const articleSelectors = ['article', '[class*="article"]', '[class*="post-content"]', '[class*="entry-content"]'];
    const hasArticleBody = articleSelectors.some(s => {
      const el = document.querySelector(s);
      return el && el.textContent.length > 1000;
    });

    // Testimonials/reviews
    const hasTestimonials = exists('[class*="testimonial"]') ||
                           exists('[class*="review"]') ||
                           exists('[class*="otzyv"]') ||
                           exists('[class*="feedback"]') ||
                           exists('[class*="quote"]');

    return {
      // Product indicators
      hasPrice,
      priceText,
      hasAddToCart,
      hasProductGallery,
      hasProductSpecs,

      // Catalog indicators
      productCount,
      hasFilters,
      hasPagination,

      // Contact indicators
      hasContactForm,
      hasMap,
      hasPhoneNumber,
      hasAddress,

      // Meta data
      metaDescription: metaDescription?.slice(0, 150),
      ogType,
      schemaType,
      jsonLdType,

      // Navigation
      hasBreadcrumbs,
      breadcrumbsText,

      // Page hints
      h1Text: h1Text?.slice(0, 100),
      isHomePage,

      // Navigation & content
      navItems: navItems.slice(0, 10),
      headings: headings.slice(0, 10),
      mainText: mainText.slice(0, 500),

      // Section type indicators
      hasTeamSection,
      hasFaqSection,
      hasPriceTable,
      hasPortfolioGallery,
      hasArticleBody,
      hasTestimonials
    };
  });
}

module.exports = {
  analyzePageContent
};
