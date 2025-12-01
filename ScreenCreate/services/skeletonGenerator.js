const path = require('path');
const fs = require('fs').promises;
const { getBrowser, setupPage, dismissCookieBanner } = require('./browser');

// Viewport for skeleton screenshots
const VIEWPORT = { width: 1920, height: 1080 };

/**
 * Generate skeleton screenshot - page structure without content
 * Content is replaced with gray placeholder blocks
 */
async function generateSkeleton(url, outputPath) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await setupPage(page);
    await page.setViewport(VIEWPORT);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Dismiss cookie banners
    await dismissCookieBanner(page);

    // Wait for page to stabilize
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

    // Replace content with skeleton placeholders
    await page.evaluate(() => {
      // Replace all text with gray blocks
      const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, button');
      textElements.forEach(el => {
        // Only process leaf elements (no child elements with text)
        const hasTextChildren = Array.from(el.children).some(child =>
          child.textContent && child.textContent.trim().length > 0
        );

        if (!hasTextChildren && el.textContent && el.textContent.trim().length > 0) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const height = rect.height;
            const width = rect.width;

            // Create skeleton block
            el.innerHTML = '';
            el.style.backgroundColor = '#e0e0e0';
            el.style.minHeight = `${height}px`;
            el.style.minWidth = `${Math.min(width, 300)}px`;
            el.style.borderRadius = '4px';
            el.style.color = 'transparent';
          }
        }
      });

      // Replace images with gray placeholders
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        const rect = img.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Create placeholder SVG
          const svg = `data:image/svg+xml,${encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
              <rect fill="#d0d0d0" width="100%" height="100%"/>
              <text fill="#999" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">
                [IMAGE]
              </text>
            </svg>
          `)}`;
          img.src = svg;
          img.style.backgroundColor = '#d0d0d0';
        }
      });

      // Replace background images
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.backgroundImage && style.backgroundImage !== 'none' && !style.backgroundImage.includes('gradient')) {
          el.style.backgroundImage = 'none';
          el.style.backgroundColor = el.style.backgroundColor || '#e8e8e8';
        }
      });

      // Hide videos
      const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
      videos.forEach(v => {
        v.style.backgroundColor = '#d0d0d0';
        v.style.visibility = 'hidden';
      });
    });

    // Take skeleton screenshot
    await page.screenshot({
      path: outputPath,
      type: 'png',
      fullPage: true
    });

    return outputPath;
  } finally {
    await page.close();
  }
}

/**
 * Detect page sections for AI-friendly structure
 */
async function detectSections(url) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await setupPage(page);
    await page.setViewport(VIEWPORT);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await dismissCookieBanner(page);

    const sections = await page.evaluate(() => {
      const result = [];

      // Helper to get a readable selector
      const getSelector = (el) => {
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.split(' ').filter(c => c.length > 0 && !c.includes(':'));
          if (classes.length > 0) return `.${classes[0]}`;
        }
        return el.tagName.toLowerCase();
      };

      // Helper to extract content placeholders
      const extractContent = (el, type) => {
        const content = {};

        switch (type) {
          case 'header':
            const logo = el.querySelector('img[alt*="logo" i], img[class*="logo" i], .logo img, [class*="logo"] img');
            const nav = el.querySelector('nav, [class*="nav"], ul');
            content.logo = logo ? '[LOGO]' : null;
            content.nav = nav ? Array.from(nav.querySelectorAll('a')).slice(0, 6).map(() => '[NAV_ITEM]') : [];
            break;

          case 'hero':
            const h1 = el.querySelector('h1');
            const subtitle = el.querySelector('h2, p');
            const cta = el.querySelector('a, button');
            const heroImg = el.querySelector('img');
            content.title = h1 ? '[HEADLINE]' : null;
            content.subtitle = subtitle ? '[SUBHEADLINE]' : null;
            content.cta = cta ? '[BUTTON_TEXT]' : null;
            content.image = heroImg ? '[HERO_IMAGE]' : null;
            break;

          case 'features':
          case 'services':
            const items = el.querySelectorAll('[class*="item"], [class*="card"], article, li');
            content.items = Array.from(items).slice(0, 6).map((item, i) => ({
              icon: '[ICON]',
              title: `[FEATURE_${i + 1}]`,
              text: `[DESCRIPTION_${i + 1}]`
            }));
            break;

          case 'gallery':
            const images = el.querySelectorAll('img');
            content.items = Array.from(images).slice(0, 12).map((_, i) => `[IMAGE_${i + 1}]`);
            break;

          case 'testimonials':
            const quotes = el.querySelectorAll('[class*="quote"], blockquote, [class*="review"]');
            content.items = Array.from(quotes).slice(0, 3).map((_, i) => ({
              quote: `[QUOTE_${i + 1}]`,
              author: `[AUTHOR_${i + 1}]`
            }));
            break;

          case 'footer':
            const phone = el.textContent.match(/[\+]?[\d\s\-\(\)]{10,}/);
            const email = el.querySelector('a[href^="mailto:"]');
            content.phone = '[PHONE]';
            content.email = '[EMAIL]';
            content.address = '[ADDRESS]';
            break;

          default:
            content.text = '[CONTENT]';
        }

        return content;
      };

      // Detect header
      const header = document.querySelector('header, [role="banner"], .header, #header');
      if (header) {
        result.push({
          type: 'header',
          selector: getSelector(header),
          description: 'Шапка сайта с логотипом и навигацией',
          content: extractContent(header, 'header')
        });
      }

      // Detect hero section
      const heroSelectors = ['.hero', '.banner', '[class*="hero"]', 'section:first-of-type', '.jumbotron', '[class*="main-banner"]'];
      for (const sel of heroSelectors) {
        const hero = document.querySelector(sel);
        if (hero) {
          const rect = hero.getBoundingClientRect();
          if (rect.height > 300) {
            result.push({
              type: 'hero',
              selector: getSelector(hero),
              description: 'Главный баннер с заголовком и призывом к действию',
              content: extractContent(hero, 'hero')
            });
            break;
          }
        }
      }

      // Detect features/services
      const featuresSelectors = ['.features', '.services', '[class*="feature"]', '[class*="service"]', '[class*="benefit"]'];
      for (const sel of featuresSelectors) {
        const features = document.querySelector(sel);
        if (features) {
          result.push({
            type: 'features',
            selector: getSelector(features),
            description: 'Блок с преимуществами/услугами',
            content: extractContent(features, 'features')
          });
          break;
        }
      }

      // Detect gallery
      const gallerySelectors = ['.gallery', '.portfolio', '[class*="gallery"]', '[class*="portfolio"]'];
      for (const sel of gallerySelectors) {
        const gallery = document.querySelector(sel);
        if (gallery) {
          result.push({
            type: 'gallery',
            selector: getSelector(gallery),
            description: 'Галерея изображений/работ',
            content: extractContent(gallery, 'gallery')
          });
          break;
        }
      }

      // Detect testimonials
      const testimonialsSelectors = ['.testimonials', '.reviews', '[class*="testimonial"]', '[class*="review"]'];
      for (const sel of testimonialsSelectors) {
        const testimonials = document.querySelector(sel);
        if (testimonials) {
          result.push({
            type: 'testimonials',
            selector: getSelector(testimonials),
            description: 'Отзывы клиентов',
            content: extractContent(testimonials, 'testimonials')
          });
          break;
        }
      }

      // Detect CTA
      const ctaSelectors = ['.cta', '[class*="call-to-action"]', '[class*="cta"]'];
      for (const sel of ctaSelectors) {
        const cta = document.querySelector(sel);
        if (cta) {
          result.push({
            type: 'cta',
            selector: getSelector(cta),
            description: 'Призыв к действию',
            content: { title: '[CTA_TITLE]', button: '[CTA_BUTTON]' }
          });
          break;
        }
      }

      // Detect footer
      const footer = document.querySelector('footer, [role="contentinfo"], .footer, #footer');
      if (footer) {
        result.push({
          type: 'footer',
          selector: getSelector(footer),
          description: 'Подвал с контактами и копирайтом',
          content: extractContent(footer, 'footer')
        });
      }

      return result;
    });

    return sections;
  } finally {
    await page.close();
  }
}

module.exports = {
  generateSkeleton,
  detectSections
};
