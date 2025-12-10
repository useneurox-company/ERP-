const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Helper function to replace deprecated page.waitForTimeout
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Auto-detect Chrome path based on OS
function findChromePath() {
  // Check environment variable first
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  // Common Chrome paths by OS
  const paths = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ]
  };

  const osPaths = paths[process.platform] || paths.linux;
  for (const p of osPaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback - let puppeteer try to find it
  return null;
}

const CHROME_PATH = findChromePath();

let browser = null;
let visibleBrowser = null;

async function getBrowser(options = {}) {
  const { visible = false } = options;

  // Visible browser (headless: false) - opens real Chrome window
  if (visible) {
    // Check if existing browser is still connected
    if (visibleBrowser) {
      try {
        // Test if browser is still alive
        if (!visibleBrowser.isConnected()) {
          console.log('[Browser] Visible browser disconnected, will create new one');
          visibleBrowser = null;
        }
      } catch (e) {
        console.log('[Browser] Error checking visible browser, will create new one:', e.message);
        visibleBrowser = null;
      }
    }

    if (!visibleBrowser) {
      const launchOptions = {
        headless: false,  // VISIBLE BROWSER!
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,900',
          '--window-position=100,50'
        ]
      };
      if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;

      console.log('[Browser] Launching visible browser...');
      visibleBrowser = await puppeteer.launch(launchOptions);
      console.log('[Browser] Visible browser launched successfully');
    }
    return visibleBrowser;
  }

  // Default headless browser
  // Check if existing browser is still connected
  if (browser) {
    try {
      if (!browser.isConnected()) {
        console.log('[Browser] Headless browser disconnected, will create new one');
        browser = null;
      }
    } catch (e) {
      console.log('[Browser] Error checking headless browser, will create new one:', e.message);
      browser = null;
    }
  }

  if (!browser) {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    };
    if (CHROME_PATH) launchOptions.executablePath = CHROME_PATH;

    console.log('[Browser] Launching headless browser...');
    browser = await puppeteer.launch(launchOptions);
    console.log('[Browser] Headless browser launched successfully');
  }
  return browser;
}

async function setupPage(page) {
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
  });
}

// Common cookie consent button selectors
const COOKIE_SELECTORS = [
  // Generic accept buttons
  'button[id*="accept"]',
  'button[id*="cookie"]',
  'button[class*="accept"]',
  'button[class*="cookie"]',
  'a[id*="accept"]',
  'a[class*="accept"]',
  '[data-testid*="accept"]',
  '[data-testid*="cookie"]',

  // Common text patterns (Russian)
  'button:has-text("Принять")',
  'button:has-text("Согласен")',
  'button:has-text("Хорошо")',
  'button:has-text("OK")',
  'button:has-text("Понятно")',
  'a:has-text("Принять")',

  // Common text patterns (English)
  'button:has-text("Accept")',
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("I agree")',
  'button:has-text("Got it")',
  'button:has-text("Allow")',
  'button:has-text("Allow all")',

  // Popular cookie consent frameworks
  '#onetrust-accept-btn-handler',
  '.onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  '.cc-btn.cc-allow',
  '.cc-accept-all',
  '#gdpr-cookie-accept',
  '.gdpr-accept',
  '#cookie-accept',
  '.cookie-accept',
  '#cookies-accept',
  '.cookies-accept',
  '[aria-label*="accept cookie"]',
  '[aria-label*="Accept cookie"]',

  // Close buttons for cookie banners
  '.cookie-banner button',
  '.cookie-notice button',
  '.cookie-popup button',
  '#cookie-banner button',
  '#cookie-notice button',
  '#cookie-popup button',
  '[class*="cookie"] button[class*="close"]',
  '[class*="cookie"] button[class*="accept"]',
  '[id*="cookie"] button[class*="close"]',
  '[id*="cookie"] button[class*="accept"]',

  // Modal close buttons
  '[role="dialog"] button[class*="close"]',
  '[role="dialog"] button[aria-label*="close"]',
  '[aria-modal="true"] button[class*="close"]',
  '.modal button[class*="close"]',
  '.modal .close',
  '[class*="modal"] button[class*="close"]',
  'button[class*="close-modal"]',
  'button[class*="modal-close"]',

  // Generic close buttons in overlays
  '[class*="overlay"] button[class*="close"]',
  '[class*="popup"] button[class*="close"]',
  '[class*="dialog"] button[class*="close"]'
];

async function dismissCookieBanner(page, aggressive = true) {
  try {
    // Wait a bit for cookie banners to appear
    await sleep(1500);

    // Try pressing Escape first to close any modal
    await page.keyboard.press('Escape');
    await sleep(300);

    // Try to find and click cookie accept buttons
    for (const selector of COOKIE_SELECTORS) {
      try {
        // Handle :has-text pseudo selector manually
        if (selector.includes(':has-text(')) {
          const match = selector.match(/(.*):has-text\("(.*)"\)/);
          if (match) {
            const [, tagSelector, text] = match;
            const clicked = await page.evaluate((tag, txt) => {
              const elements = document.querySelectorAll(tag || '*');
              for (const el of elements) {
                if (el.textContent && el.textContent.trim().toLowerCase().includes(txt.toLowerCase())) {
                  if (el.offsetParent !== null) { // Check if visible
                    el.click();
                    return true;
                  }
                }
              }
              return false;
            }, tagSelector, text);

            if (clicked) {
              console.log(`[Cookie] Closed with text: "${text}"`);
              await sleep(500);
              return true;
            }
          }
        } else {
          // Standard selector
          const element = await page.$(selector);
          if (element) {
            const isVisible = await element.evaluate(el => {
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
            });

            if (isVisible) {
              await element.click();
              console.log(`[Cookie] Closed with selector: ${selector}`);
              await sleep(500);
              return true;
            }
          }
        }
      } catch (e) {
        // Selector didn't match, try next
      }
    }

    // Aggressive mode: remove all fixed overlays and modals
    if (aggressive) {
      await page.evaluate(() => {
        // Remove all role="dialog" elements
        document.querySelectorAll('[role="dialog"], [aria-modal="true"]').forEach(el => {
          console.log('[Cookie] Removing dialog element');
          el.remove();
        });

        // Remove modal backdrops
        document.querySelectorAll('.modal-backdrop, [class*="backdrop"], [class*="overlay"]').forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'absolute') {
            el.remove();
          }
        });

        // Remove fixed elements that look like popups/banners
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          if (style.position === 'fixed') {
            // Cookie banner at bottom
            if (rect.bottom > window.innerHeight - 200 && rect.height < 400) {
              el.remove();
              return;
            }

            // Centered modal/popup
            if (rect.top > 50 && rect.top < window.innerHeight - 200) {
              if (rect.width > 200 && rect.width < window.innerWidth - 100) {
                if (rect.height > 100 && rect.height < window.innerHeight - 100) {
                  el.remove();
                  return;
                }
              }
            }
          }
        });

        // Also check for elements with cookie/consent/privacy in class/id
        const patterns = ['cookie', 'consent', 'gdpr', 'privacy', 'divident'];
        document.querySelectorAll('div, section, aside, [class*="modal"]').forEach(el => {
          const classAndId = ((el.className || '') + ' ' + (el.id || '')).toLowerCase();
          const matchesPattern = patterns.some(p => classAndId.includes(p));

          if (matchesPattern) {
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'absolute') {
              el.remove();
            }
          }
        });
      });

      // Try Escape again after cleanup
      await page.keyboard.press('Escape');
      await sleep(200);
    }

    return false;
  } catch (error) {
    console.log('[Cookie] Dismiss error (non-critical):', error.message);
    return false;
  }
}

async function takeScreenshot(url, options = {}) {
  const {
    width = 1920,
    height = 1080,
    fullPage = false,
    format = 'png',
    quality = 80
  } = options;

  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await setupPage(page);
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Try to dismiss cookie banners
    await dismissCookieBanner(page);

    const screenshotOptions = {
      type: format,
      fullPage
    };

    if (format === 'jpeg' || format === 'webp') {
      screenshotOptions.quality = quality;
    }

    const screenshot = await page.screenshot(screenshotOptions);
    return screenshot;
  } finally {
    await page.close();
  }
}

/**
 * Take screenshot with cookies - for authenticated pages
 * Puppeteer ALWAYS works with any CSS (no html2canvas issues)
 */
async function takeScreenshotWithAuth(url, options = {}) {
  const {
    width = 1920,
    height = 1080,
    fullPage = false,
    format = 'png',
    quality = 80,
    cookies = [],        // Array of cookie objects
    localStorage = {},   // localStorage key-value pairs
    sessionStorage = {}  // sessionStorage key-value pairs
  } = options;

  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await setupPage(page);
    await page.setViewport({ width, height });

    // First navigate to the domain to set cookies/storage
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Set cookies if provided
    if (cookies && cookies.length > 0) {
      const cookiesWithDomain = cookies.map(cookie => ({
        ...cookie,
        domain: cookie.domain || domain,
        path: cookie.path || '/'
      }));
      await page.setCookie(...cookiesWithDomain);
      console.log(`[Browser] Set ${cookiesWithDomain.length} cookies for ${domain}`);
    }

    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // Set localStorage if provided
    if (Object.keys(localStorage).length > 0) {
      await page.evaluate((storageData) => {
        for (const [key, value] of Object.entries(storageData)) {
          window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      }, localStorage);
      console.log(`[Browser] Set ${Object.keys(localStorage).length} localStorage items`);
    }

    // Set sessionStorage if provided
    if (Object.keys(sessionStorage).length > 0) {
      await page.evaluate((storageData) => {
        for (const [key, value] of Object.entries(storageData)) {
          window.sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
      }, sessionStorage);
      console.log(`[Browser] Set ${Object.keys(sessionStorage).length} sessionStorage items`);
    }

    // If storage was set, reload the page to apply auth
    if (Object.keys(localStorage).length > 0 || Object.keys(sessionStorage).length > 0) {
      await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
    }

    // Wait for dynamic content to render
    await sleep(500);

    const screenshotOptions = {
      type: format,
      fullPage,
      encoding: 'base64'  // Return base64 for easier transfer
    };

    if (format === 'jpeg' || format === 'webp') {
      screenshotOptions.quality = quality;
    }

    const screenshot = await page.screenshot(screenshotOptions);
    return {
      screenshot,
      format,
      width,
      height
    };
  } finally {
    await page.close();
  }
}

async function getPageHtml(url, options = {}) {
  const { timeout = 60000, waitFor = null } = options;

  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await setupPage(page);
    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 10000 });
    }

    const html = await page.content();
    const title = await page.title();

    return { html, title, url };
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

module.exports = {
  takeScreenshot,
  takeScreenshotWithAuth,
  getPageHtml,
  closeBrowser,
  getBrowser,
  setupPage,
  dismissCookieBanner
};
