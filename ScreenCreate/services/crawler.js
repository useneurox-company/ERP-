const path = require('path');
const fs = require('fs').promises;
const { getBrowser, setupPage, dismissCookieBanner } = require('./browser');
const { shouldScreenshotPage } = require('./aiFilter');
const { analyzePageContent } = require('./pageAnalyzer');
const { optimizeForAI } = require('./imageOptimizer');
const { captureInteractive } = require('./interactiveCapture');
const { extractDesignTokens } = require('./designExtractor');
const { downloadImages } = require('./imageDownloader');

async function crawlSite(startUrl, options = {}) {
  const {
    onProgress = null,
    screenshotOptions = { width: 1920, height: 1080, format: 'png', fullPage: true }
  } = options;

  const baseUrl = new URL(startUrl);
  const siteName = baseUrl.hostname.replace(/[^a-z0-9]/gi, '-');
  const visited = new Set();
  const pages = [];
  const queue = [startUrl];

  const browserInstance = await getBrowser();

  while (queue.length > 0) {
    const url = queue.shift();

    // Normalize URL
    const normalizedUrl = normalizeUrl(url);
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);

    try {
      const page = await browserInstance.newPage();
      await setupPage(page);
      await page.setViewport({
        width: screenshotOptions.width,
        height: screenshotOptions.height
      });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Close cookie banners
      await dismissCookieBanner(page);

      const title = await page.title();
      const pathname = new URL(url).pathname;
      const fileName = pathToFileName(pathname);

      const pageInfo = {
        url,
        pathname,
        title,
        fileName: `${fileName}.${screenshotOptions.format}`
      };
      pages.push(pageInfo);

      if (onProgress) {
        onProgress({
          type: 'page_found',
          page: pageInfo,
          total: pages.length,
          queued: queue.length
        });
      }

      // Find all internal links
      const links = await page.evaluate((baseHost) => {
        const anchors = document.querySelectorAll('a[href]');
        const urls = [];

        anchors.forEach(a => {
          try {
            const href = a.href;
            if (!href) return;

            const linkUrl = new URL(href);

            // Only same domain
            if (linkUrl.hostname !== baseHost) return;
            // Skip anchors
            if (linkUrl.hash && linkUrl.pathname === window.location.pathname) return;
            // Skip files
            if (href.match(/\.(pdf|zip|jpg|jpeg|png|gif|svg|mp4|mp3|doc|docx|xls|xlsx)$/i)) return;
            // Skip mailto/tel
            if (href.startsWith('mailto:') || href.startsWith('tel:')) return;

            urls.push(linkUrl.origin + linkUrl.pathname);
          } catch (e) {}
        });

        return [...new Set(urls)];
      }, baseUrl.hostname);

      // Add new links to queue
      for (const link of links) {
        const normalized = normalizeUrl(link);
        if (!visited.has(normalized) && !queue.includes(link)) {
          queue.push(link);
        }
      }

      await page.close();
    } catch (error) {
      console.error(`Error crawling ${url}:`, error.message);
      if (onProgress) {
        onProgress({
          type: 'error',
          url,
          error: error.message
        });
      }
    }
  }

  return {
    site: baseUrl.hostname,
    siteName,
    startUrl,
    pages
  };
}

// Check if pathname matches a pattern (supports * wildcard)
function matchesPattern(pathname, pattern) {
  // Convert pattern to regex: * becomes .*
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape special chars except *
    .replace(/\*/g, '.*');                   // * becomes .*
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathname);
}

// Check if pathname matches any of the patterns
function matchesAnyPattern(pathname, patterns) {
  if (!patterns || patterns.length === 0) return true; // no filter = match all
  return patterns.some(pattern => matchesPattern(pathname, pattern));
}

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 }
};

async function crawlAndScreenshot(startUrl, options = {}) {
  const {
    onProgress = null,
    shouldStop = null,
    includePatterns = [],
    maxPages = 0,
    aiPrompt = null,
    compressForAI = false,
    screenshotOptions = { format: 'png', fullPage: true },
    captureOptions = { desktop: true, mobile: false, tablet: false, html: false },
    parallelTabs = 1,  // Number of parallel browser tabs (1 = sequential)
    fastMode = false   // Faster but less reliable
  } = options;

  // Timing settings based on mode
  const WAIT_TIMES = fastMode
    ? { pageLoad: 'domcontentloaded', viewport: 100, cookie: 200 }
    : { pageLoad: 'networkidle2', viewport: 300, cookie: 500 };

  const baseUrl = new URL(startUrl);
  const siteName = baseUrl.hostname.replace(/[^a-z0-9]/gi, '-');
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', siteName);

  // Create directory structure
  await fs.mkdir(screenshotsDir, { recursive: true });

  // Create subdirectories based on options
  if (captureOptions.desktop) await fs.mkdir(path.join(screenshotsDir, 'desktop'), { recursive: true });
  if (captureOptions.mobile) await fs.mkdir(path.join(screenshotsDir, 'mobile'), { recursive: true });
  if (captureOptions.tablet) await fs.mkdir(path.join(screenshotsDir, 'tablet'), { recursive: true });
  if (captureOptions.html) await fs.mkdir(path.join(screenshotsDir, 'html'), { recursive: true });
  if (captureOptions.hover || captureOptions.tabs || captureOptions.modals) {
    await fs.mkdir(path.join(screenshotsDir, 'interactive'), { recursive: true });
  }
  if (captureOptions.images) {
    await fs.mkdir(path.join(screenshotsDir, 'assets'), { recursive: true });
  }

  // Shared context for page processing
  const context = {
    browserInstance: await getBrowser(),
    baseUrl,
    visited: new Set(),
    pages: [],
    queue: [startUrl],
    designSystem: null,
    shouldStop,
    maxPages,
    onProgress,
    aiPrompt,
    includePatterns,
    compressForAI,
    screenshotOptions,
    captureOptions,
    screenshotsDir,
    WAIT_TIMES
  };

  if (onProgress) {
    onProgress({ type: 'start', site: baseUrl.hostname, dir: screenshotsDir });
  }

  // Choose processing mode based on parallelTabs setting
  if (parallelTabs <= 1) {
    // SEQUENTIAL MODE (original, stable)
    console.log('[Crawler] Using sequential mode (1 tab)');
    await processSequential(context);
  } else {
    // PARALLEL MODE (faster)
    console.log(`[Crawler] Using parallel mode (${parallelTabs} tabs)`);
    await processParallel(context, parallelTabs);
  }

  // Generate report
  const report = {
    site: baseUrl.hostname,
    siteName,
    startUrl,
    crawledAt: new Date().toISOString(),
    totalPages: context.pages.length,
    options: {
      desktop: captureOptions.desktop,
      mobile: captureOptions.mobile,
      tablet: captureOptions.tablet,
      html: captureOptions.html,
      meta: captureOptions.meta,
      compressForAI: compressForAI
    },
    pages: context.pages
  };

  // Save report
  const reportPath = path.join(screenshotsDir, 'report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  // Save design system if extracted
  if (context.designSystem) {
    // Add pages info to design system
    context.designSystem.pages = context.pages.map(p => ({
      url: p.pathname,
      title: p.title,
      screenshot: p.files?.desktop || p.files?.mobile || null
    }));

    const designSystemPath = path.join(screenshotsDir, 'design-system.json');
    await fs.writeFile(designSystemPath, JSON.stringify(context.designSystem, null, 2));

    if (onProgress) {
      onProgress({ type: 'design_saved', path: designSystemPath });
    }
  }

  if (onProgress) {
    onProgress({ type: 'complete', report, hasDesignSystem: !!context.designSystem });
  }

  return report;
}

// ============== SEQUENTIAL PROCESSING (original mode) ==============
async function processSequential(context) {
  while (context.queue.length > 0) {
    // Check if should stop
    if (context.shouldStop && context.shouldStop()) {
      if (context.onProgress) {
        context.onProgress({ type: 'stopping', message: 'Остановка по запросу...' });
      }
      break;
    }

    // Check max pages limit
    if (context.maxPages > 0 && context.pages.length >= context.maxPages) {
      if (context.onProgress) {
        context.onProgress({ type: 'limit_reached', message: `Достигнут лимит ${context.maxPages} страниц` });
      }
      break;
    }

    const url = context.queue.shift();
    await processPage(url, context);
  }
}

// ============== PARALLEL PROCESSING (fast mode) ==============
async function processParallel(context, numWorkers) {
  const workers = [];

  for (let i = 0; i < numWorkers; i++) {
    workers.push(processWorker(context, i));
  }

  await Promise.all(workers);
}

async function processWorker(context, workerId) {
  while (true) {
    // Check if should stop
    if (context.shouldStop && context.shouldStop()) {
      break;
    }

    // Check max pages limit
    if (context.maxPages > 0 && context.pages.length >= context.maxPages) {
      break;
    }

    // Get next URL from queue
    const url = context.queue.shift();
    if (!url) {
      // Queue empty, wait a bit and check again (other workers may add URLs)
      await new Promise(r => setTimeout(r, 100));
      if (context.queue.length === 0) {
        break; // Still empty, exit
      }
      continue;
    }

    try {
      await processPage(url, context);
    } catch (error) {
      console.error(`[Worker ${workerId}] Error processing ${url}:`, error.message);
    }
  }
}

// ============== PAGE PROCESSING (shared by both modes) ==============
async function processPage(url, context) {
  const {
    browserInstance,
    baseUrl,
    visited,
    pages,
    queue,
    onProgress,
    aiPrompt,
    includePatterns,
    compressForAI,
    screenshotOptions,
    captureOptions,
    screenshotsDir,
    WAIT_TIMES
  } = context;

  const normalizedUrl = normalizeUrl(url);

  // Skip if already visited
  if (visited.has(normalizedUrl)) return;
  visited.add(normalizedUrl);

  const pathname = new URL(url).pathname;

  try {
    const page = await browserInstance.newPage();
    await setupPage(page);

    // Set initial viewport (desktop by default)
    await page.setViewport({
      width: VIEWPORTS.desktop.width,
      height: VIEWPORTS.desktop.height
    });

    await page.goto(url, { waitUntil: WAIT_TIMES.pageLoad, timeout: 60000 });

    // Wait after page load
    await page.evaluate((ms) => new Promise(r => setTimeout(r, ms)), WAIT_TIMES.viewport);

    // Close cookie banners
    await dismissCookieBanner(page);

    const title = await page.title();
    const fileName = pathToFileName(pathname);

    // Determine if we should screenshot this page
    let shouldScreenshot = true;

    if (aiPrompt) {
      // Analyze page content for AI context
      const pageContext = await analyzePageContent(page);

      // Use AI to decide with full page context
      if (onProgress) {
        onProgress({ type: 'ai_checking', url, pathname, title });
      }
      shouldScreenshot = await shouldScreenshotPage(aiPrompt, { url, pathname, title, pageContext });
    } else if (includePatterns.length > 0) {
      // Use pattern matching
      shouldScreenshot = matchesAnyPattern(pathname, includePatterns);
    }

    // Only take screenshot if matches criteria
    if (shouldScreenshot) {
      const pageInfo = {
        url,
        pathname,
        title,
        files: {}
      };

      // Helper to take screenshot for a device
      const takeScreenshot = async (deviceType) => {
        const viewport = VIEWPORTS[deviceType];
        await page.setViewport({ width: viewport.width, height: viewport.height });

        // Wait for responsive layout to apply
        await page.evaluate((ms) => new Promise(r => setTimeout(r, ms)), WAIT_TIMES.viewport);

        const deviceFileName = `${fileName}.${screenshotOptions.format}`;
        const deviceFilePath = path.join(screenshotsDir, deviceType, deviceFileName);

        const screenshotOpts = {
          path: deviceFilePath,
          type: screenshotOptions.format,
          fullPage: screenshotOptions.fullPage
        };

        if (screenshotOptions.format === 'jpeg') {
          screenshotOpts.quality = screenshotOptions.quality || 80;
        }

        try {
          await page.screenshot(screenshotOpts);
        } catch (screenshotError) {
          // Handle "Page is too large" error - retry without fullPage
          if (screenshotError.message.includes('too large') && screenshotOpts.fullPage) {
            console.log(`[Screenshot] Page too large for fullPage, retrying viewport-only: ${pathname}`);
            screenshotOpts.fullPage = false;
            await page.screenshot(screenshotOpts);
          } else {
            throw screenshotError;
          }
        }

        // Compress for AI if enabled
        let finalFileName = deviceFileName;
        if (compressForAI) {
          const optimizedPath = await optimizeForAI(deviceFilePath);
          finalFileName = path.basename(optimizedPath);
        }

        return `${deviceType}/${finalFileName}`;
      };

      // Desktop screenshot
      if (captureOptions.desktop) {
        pageInfo.files.desktop = await takeScreenshot('desktop');
      }

      // Mobile screenshot
      if (captureOptions.mobile) {
        pageInfo.files.mobile = await takeScreenshot('mobile');
      }

      // Tablet screenshot
      if (captureOptions.tablet) {
        pageInfo.files.tablet = await takeScreenshot('tablet');
      }

      // Save HTML
      if (captureOptions.html) {
        const htmlContent = await page.content();
        const htmlFileName = `${fileName}.html`;
        const htmlFilePath = path.join(screenshotsDir, 'html', htmlFileName);
        await fs.writeFile(htmlFilePath, htmlContent, 'utf-8');
        pageInfo.files.html = `html/${htmlFileName}`;
      }

      // Save metadata
      if (captureOptions.meta) {
        const meta = await page.evaluate(() => {
          const getMeta = (name) => {
            const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
            return el ? el.getAttribute('content') : null;
          };
          return {
            title: document.title,
            description: getMeta('description'),
            ogTitle: getMeta('og:title'),
            ogDescription: getMeta('og:description'),
            ogImage: getMeta('og:image')
          };
        });
        pageInfo.meta = meta;
      }

      // Capture interactive states (hover, tabs, modals)
      if (captureOptions.hover || captureOptions.tabs || captureOptions.modals) {
        // Reset to desktop viewport for interactive capture
        await page.setViewport({ width: VIEWPORTS.desktop.width, height: VIEWPORTS.desktop.height });
        await page.evaluate((ms) => new Promise(r => setTimeout(r, ms)), WAIT_TIMES.viewport);

        const interactiveResults = await captureInteractive(page, {
          screenshotsDir,
          fileName,
          format: screenshotOptions.format,
          captureHover: captureOptions.hover,
          captureTabs: captureOptions.tabs,
          captureModals: captureOptions.modals,
          compressForAI,
          optimizeForAI: compressForAI ? optimizeForAI : null
        });

        if (interactiveResults.length > 0) {
          pageInfo.files.interactive = interactiveResults;
        }
      }

      // Extract design tokens (only on first page)
      if (!context.designSystem && (captureOptions.colors || captureOptions.typography)) {
        try {
          if (onProgress) {
            onProgress({ type: 'design_extracting', url, message: 'Извлекаю дизайн-токены...' });
          }
          const tokens = await extractDesignTokens(page);
          context.designSystem = {
            site: baseUrl.hostname,
            crawledAt: new Date().toISOString(),
            colors: captureOptions.colors ? tokens.colors : undefined,
            typography: captureOptions.typography ? tokens.typography : undefined,
            images: [],
            pages: []
          };
        } catch (e) {
          console.log('[Design] Error extracting tokens:', e.message);
        }
      }

      // Download images (only on first page)
      if (context.designSystem && captureOptions.images && context.designSystem.images.length === 0) {
        try {
          if (onProgress) {
            onProgress({ type: 'images_downloading', url, message: 'Скачиваю изображения...' });
          }
          const assetsDir = path.join(screenshotsDir, 'assets');
          const downloadedImages = await downloadImages(page, assetsDir);
          context.designSystem.images = downloadedImages;
        } catch (e) {
          console.log('[Design] Error downloading images:', e.message);
        }
      }

      pages.push(pageInfo);

      if (onProgress) {
        onProgress({
          type: 'screenshot',
          page: pageInfo,
          total: pages.length,
          queued: queue.length
        });
      }
    } else {
      // Still report that we're crawling this page (but not screenshotting)
      if (onProgress) {
        onProgress({
          type: 'crawling',
          url,
          pathname,
          message: 'Пропущено (не соответствует фильтру)'
        });
      }
    }

    // Find all internal links
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
  } catch (error) {
    console.error(`Error crawling ${url}:`, error.message);
    if (onProgress) {
      onProgress({ type: 'error', url, error: error.message });
    }
  }
}

function normalizeUrl(url) {
  const u = new URL(url);
  // Remove trailing slash
  let pathname = u.pathname;
  if (pathname !== '/' && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  return u.hostname + pathname;
}

function pathToFileName(pathname) {
  if (pathname === '/' || pathname === '') {
    return 'home';
  }
  // Remove leading/trailing slashes and replace remaining with dash
  let fileName = pathname
    .replace(/^\/+|\/+$/g, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9\-]/gi, '_') || 'home';

  // Windows MAX_PATH is 260 chars. Limit filename to 80 chars to leave room for path + extension
  const MAX_FILENAME_LENGTH = 80;
  if (fileName.length > MAX_FILENAME_LENGTH) {
    // Create a simple hash from the full path for uniqueness
    let hash = 0;
    for (let i = 0; i < pathname.length; i++) {
      const char = pathname.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const hashStr = Math.abs(hash).toString(36).substring(0, 8);
    // Truncate and add hash
    fileName = fileName.substring(0, MAX_FILENAME_LENGTH - 9) + '-' + hashStr;
  }

  return fileName;
}

module.exports = {
  crawlSite,
  crawlAndScreenshot,
  normalizeUrl,
  pathToFileName
};
