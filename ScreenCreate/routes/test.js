const express = require('express');
const router = express.Router();
const { getBrowser, setupPage } = require('../services/browser');

// Store active test session
let testPage = null;
let testBrowser = null;

// Live View tracking
let lastAction = null;
let lastActionTime = null;

// Console logs storage - captures ALL console messages
let consoleLogs = [];
const MAX_CONSOLE_LOGS = 500; // Limit to prevent memory issues

// Setup console capture for a page
function setupConsoleCapture(page) {
  consoleLogs = []; // Clear on new session

  // Capture all console messages
  page.on('console', msg => {
    const logEntry = {
      type: msg.type(), // log, error, warn, info, debug, etc.
      text: msg.text(),
      timestamp: new Date().toISOString(),
      location: msg.location() // {url, lineNumber, columnNumber}
    };

    consoleLogs.push(logEntry);

    // Keep only last MAX_CONSOLE_LOGS entries
    if (consoleLogs.length > MAX_CONSOLE_LOGS) {
      consoleLogs = consoleLogs.slice(-MAX_CONSOLE_LOGS);
    }
  });

  // Capture page errors (uncaught exceptions)
  page.on('pageerror', error => {
    consoleLogs.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  });

  // Capture request failures
  page.on('requestfailed', request => {
    consoleLogs.push({
      type: 'network-error',
      text: `Failed to load: ${request.url()}`,
      reason: request.failure()?.errorText || 'Unknown',
      timestamp: new Date().toISOString()
    });
  });
}

// GET /test/live-frame — Live View frame for real-time monitoring
router.get('/live-frame', async (req, res) => {
  try {
    if (!testPage) {
      return res.json({ active: false });
    }

    const screenshot = await testPage.screenshot({ encoding: 'base64' });
    const url = testPage.url();

    res.json({
      active: true,
      screenshot: `data:image/png;base64,${screenshot}`,
      url,
      lastAction: lastAction || 'Idle',
      timestamp: Date.now()
    });
  } catch (error) {
    res.json({ active: false, error: error.message });
  }
});

// Start a new test session
router.post('/start', express.json(), async (req, res) => {
  try {
    if (testPage) {
      await testPage.close().catch(() => {});
    }

    // visible: true opens a real Chrome window on your screen!
    const { visible = false } = req.body || {};

    testBrowser = await getBrowser({ visible });
    testPage = await testBrowser.newPage();
    await setupPage(testPage);

    // Setup console capture BEFORE any navigation
    setupConsoleCapture(testPage);

    // Don't change viewport for visible browser - use natural window size
    if (!visible) {
      await testPage.setViewport({ width: 1920, height: 1080 });
    }

    lastAction = 'Session started' + (visible ? ' (VISIBLE)' : '');
    lastActionTime = Date.now();

    res.json({ success: true, message: 'Test session started', visible });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Navigate to URL
router.post('/navigate', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session. Call /test/start first' });
    }

    const { url, waitFor = 'networkidle2' } = req.body;
    lastAction = `Navigate: ${url}`;
    lastActionTime = Date.now();

    await testPage.goto(url, { waitUntil: waitFor, timeout: 30000 });

    const title = await testPage.title();
    const currentUrl = testPage.url();

    res.json({ success: true, title, url: currentUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Take screenshot
router.post('/screenshot', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { fullPage = false } = req.body;
    const screenshot = await testPage.screenshot({
      encoding: 'base64',
      fullPage
    });

    res.json({ success: true, screenshot: `data:image/png;base64,${screenshot}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Visual click indicator - shows red pulsing circle at click location (no window shake)
async function showClickIndicator(page, selector, text) {
  await page.evaluate(({ selector, text }) => {
    let el;
    if (text) {
      const elements = [...document.querySelectorAll('button, a, [role="button"], input[type="submit"], span, div')];
      el = elements.find(e => e.textContent && e.textContent.includes(text));
    } else if (selector) {
      el = document.querySelector(selector);
    }

    if (!el) return;

    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 + window.scrollX;
    const centerY = rect.top + rect.height / 2 + window.scrollY;

    // Remove any existing indicator first
    document.getElementById('claude-click-indicator')?.remove();

    // Create click indicator using absolute positioning (no reflow)
    const indicator = document.createElement('div');
    indicator.id = 'claude-click-indicator';
    indicator.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:999999;';
    indicator.innerHTML = `
      <style>
        @keyframes claude-pulse { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes claude-ring { 0% { transform: scale(1); } 100% { transform: scale(2.5); opacity: 0; } }
      </style>
      <div style="position:absolute;left:${centerX}px;top:${centerY}px;width:20px;height:20px;margin:-10px 0 0 -10px;background:#ff3333;border-radius:50%;animation:claude-pulse 0.5s ease-out forwards;box-shadow:0 0 20px #ff3333;pointer-events:none;"></div>
      <div style="position:absolute;left:${centerX}px;top:${centerY}px;width:30px;height:30px;margin:-15px 0 0 -15px;border:3px solid #ff3333;border-radius:50%;animation:claude-ring 0.5s ease-out forwards;pointer-events:none;"></div>
      <div style="position:absolute;left:${centerX}px;top:${centerY + 25}px;transform:translateX(-50%);background:#ff3333;color:#fff;padding:3px 10px;border-radius:4px;font:bold 11px Arial;white-space:nowrap;pointer-events:none;">CLICK</div>
    `;
    document.body.appendChild(indicator);

    // Highlight element without changing layout (outline only)
    const origOutline = el.style.outline;
    el.style.outline = '3px solid #ff3333';

    setTimeout(() => {
      indicator.remove();
      el.style.outline = origOutline;
    }, 600);
  }, { selector, text });

  await new Promise(resolve => setTimeout(resolve, 300));
}

// Click element
router.post('/click', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector, text } = req.body;
    lastAction = `Click: ${text || selector}`;
    lastActionTime = Date.now();

    // Show visual indicator BEFORE clicking
    await showClickIndicator(testPage, selector, text);

    if (text) {
      // Click by text content
      await testPage.evaluate((searchText) => {
        const elements = [...document.querySelectorAll('button, a, [role="button"], input[type="submit"]')];
        const el = elements.find(e => e.textContent.includes(searchText));
        if (el) el.click();
        else throw new Error(`Element with text "${searchText}" not found`);
      }, text);
    } else if (selector) {
      await testPage.click(selector);
    }

    // Wait for any navigation or network activity
    await new Promise(resolve => setTimeout(resolve, 500));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Visual type indicator - highlights input (no layout shifts)
async function showTypeIndicator(page, selector, text) {
  await page.evaluate(({ selector, text }) => {
    const el = document.querySelector(selector);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;

    // Remove existing
    document.getElementById('claude-type-indicator')?.remove();

    // Create minimal indicator (no reflow)
    const indicator = document.createElement('div');
    indicator.id = 'claude-type-indicator';
    indicator.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:999999;';
    indicator.innerHTML = `
      <div style="position:absolute;left:${x}px;top:${y - 24}px;background:#3b82f6;color:#fff;padding:2px 8px;border-radius:3px;font:bold 10px Arial;white-space:nowrap;pointer-events:none;">TYPING</div>
    `;
    document.body.appendChild(indicator);

    // Highlight input (outline only - no layout shift)
    el.dataset.origOutline = el.style.outline;
    el.style.outline = '2px solid #3b82f6';

    window.__claudeTypeEl = el;
  }, { selector, text });
}

async function hideTypeIndicator(page) {
  await page.evaluate(() => {
    document.getElementById('claude-type-indicator')?.remove();
    if (window.__claudeTypeEl) {
      window.__claudeTypeEl.style.outline = window.__claudeTypeEl.dataset.origOutline || '';
      delete window.__claudeTypeEl;
    }
  });
}

// Type into input
router.post('/type', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector, text, clear = false } = req.body;
    lastAction = `Type: "${text}" → ${selector}`;
    lastActionTime = Date.now();

    // Show visual indicator BEFORE typing
    await showTypeIndicator(testPage, selector, text);

    if (clear) {
      await testPage.click(selector, { clickCount: 3 });
    }

    // Type slower so user can see it
    await testPage.type(selector, text, { delay: 50 });

    // Hide indicator after typing
    await hideTypeIndicator(testPage);

    res.json({ success: true });
  } catch (error) {
    await hideTypeIndicator(testPage).catch(() => {});
    res.status(500).json({ error: error.message });
  }
});

// Wait for element
router.post('/wait', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector, timeout = 5000 } = req.body;
    lastAction = `Wait: ${selector}`;
    lastActionTime = Date.now();

    await testPage.waitForSelector(selector, { timeout });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get page content/text
router.post('/content', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector } = req.body;

    let content;
    if (selector) {
      content = await testPage.$eval(selector, el => el.textContent);
    } else {
      content = await testPage.evaluate(() => document.body.innerText);
    }

    const title = await testPage.title();
    const url = testPage.url();

    res.json({ success: true, content, title, url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if element exists
router.post('/exists', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector } = req.body;
    const element = await testPage.$(selector);

    res.json({ success: true, exists: !!element });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute JavaScript
router.post('/evaluate', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { script } = req.body;
    const result = await testPage.evaluate(script);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End test session
router.post('/end', async (req, res) => {
  try {
    lastAction = 'Session ended';
    lastActionTime = Date.now();

    if (testPage) {
      await testPage.close().catch(() => {});
      testPage = null;
    }

    lastAction = null;
    res.json({ success: true, message: 'Test session ended' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quick test - navigate, screenshot, check content in one call
// NOW INCLUDES CONSOLE ERRORS!
router.post('/quick', express.json(), async (req, res) => {
  try {
    const { url, checkSelector, checkText } = req.body;

    // Start session if needed
    if (!testPage) {
      testBrowser = await getBrowser();
      testPage = await testBrowser.newPage();
      await setupPage(testPage);

      // Setup console capture for quick test too!
      setupConsoleCapture(testPage);

      await testPage.setViewport({ width: 1920, height: 1080 });
    } else {
      // Clear previous console logs for fresh test
      consoleLogs = [];
    }

    // Navigate
    await testPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Small delay to catch any post-load errors
    await new Promise(resolve => setTimeout(resolve, 500));

    const title = await testPage.title();
    const result = { success: true, url, title };

    // Check selector if provided
    if (checkSelector) {
      const element = await testPage.$(checkSelector);
      result.selectorFound = !!element;
    }

    // Check text if provided
    if (checkText) {
      const bodyText = await testPage.evaluate(() => document.body.innerText);
      result.textFound = bodyText.includes(checkText);
    }

    // Take screenshot
    const screenshot = await testPage.screenshot({ encoding: 'base64' });
    result.screenshot = `data:image/png;base64,${screenshot}`;

    // ALWAYS include console info
    const errors = consoleLogs.filter(l =>
      ['error', 'pageerror', 'network-error'].includes(l.type)
    );
    const warnings = consoleLogs.filter(l =>
      l.type === 'warning' || l.type === 'warn'
    );

    result.console = {
      total: consoleLogs.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0,
      errors: errors,
      warnings: warnings
    };

    // Add convenience flag
    result.consoleClean = errors.length === 0;

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all interactive elements (buttons, links, inputs, selects)
router.post('/elements', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const elements = await testPage.evaluate(() => {
      const getSelector = (el) => {
        if (el.id) return `#${el.id}`;
        if (el.name) return `[name="${el.name}"]`;
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.split(' ').filter(c => c.trim()).slice(0, 2).join('.');
          if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
        }
        return el.tagName.toLowerCase();
      };

      const result = {
        buttons: [],
        links: [],
        inputs: [],
        selects: [],
        modals: [],
        forms: []
      };

      // Buttons
      document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach(el => {
        if (el.offsetParent !== null) { // visible
          result.buttons.push({
            selector: getSelector(el),
            text: el.textContent?.trim().slice(0, 50) || el.value || '',
            type: el.type || 'button',
            disabled: el.disabled
          });
        }
      });

      // Links
      document.querySelectorAll('a[href]').forEach(el => {
        if (el.offsetParent !== null) {
          result.links.push({
            selector: getSelector(el),
            text: el.textContent?.trim().slice(0, 50) || '',
            href: el.href
          });
        }
      });

      // Inputs
      document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="hidden"]), textarea').forEach(el => {
        if (el.offsetParent !== null) {
          result.inputs.push({
            selector: getSelector(el),
            type: el.type || 'text',
            name: el.name || '',
            placeholder: el.placeholder || '',
            required: el.required,
            value: el.value || ''
          });
        }
      });

      // Selects
      document.querySelectorAll('select').forEach(el => {
        if (el.offsetParent !== null) {
          const options = [...el.options].map(o => ({ value: o.value, text: o.text }));
          result.selects.push({
            selector: getSelector(el),
            name: el.name || '',
            options,
            selectedValue: el.value
          });
        }
      });

      // Modals
      document.querySelectorAll('.modal, .modal-overlay, [role="dialog"]').forEach(el => {
        const isVisible = window.getComputedStyle(el).display !== 'none' &&
                          window.getComputedStyle(el).visibility !== 'hidden';
        result.modals.push({
          selector: getSelector(el),
          visible: isVisible
        });
      });

      // Forms
      document.querySelectorAll('form').forEach(el => {
        result.forms.push({
          selector: getSelector(el),
          id: el.id || '',
          action: el.action || '',
          method: el.method || 'get'
        });
      });

      return result;
    });

    res.json({ success: true, elements });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save screenshot to file
router.post('/save-screenshot', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { filename, fullPage = true } = req.body;
    const path = require('path');
    const fs = require('fs');

    const screenshotsDir = path.join(__dirname, '../../test_screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalFilename = filename || `test_${timestamp}.png`;
    const filepath = path.join(screenshotsDir, finalFilename);

    await testPage.screenshot({ path: filepath, fullPage });

    res.json({ success: true, filepath, filename: finalFilename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Select option from dropdown
router.post('/select', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector, value } = req.body;
    await testPage.select(selector, value);
    await new Promise(resolve => setTimeout(resolve, 300));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current URL and state
router.post('/state', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const state = await testPage.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        localStorage: { ...localStorage },
        errors: window.__testErrors || [],
        alerts: window.__testAlerts || []
      };
    });

    res.json({ success: true, state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear input field
router.post('/clear', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector } = req.body;
    await testPage.click(selector, { clickCount: 3 });
    await testPage.keyboard.press('Backspace');

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scroll to element or position
router.post('/scroll', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector, x, y } = req.body;

    if (selector) {
      await testPage.evaluate((sel) => {
        document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, selector);
    } else {
      await testPage.evaluate((scrollX, scrollY) => {
        window.scrollTo(scrollX || 0, scrollY || 0);
      }, x, y);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Wait for network idle
router.post('/wait-network', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { timeout = 5000 } = req.body;
    await testPage.waitForNetworkIdle({ timeout });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ALL console logs (errors, warnings, info, etc.)
router.post('/console', express.json(), async (req, res) => {
  try {
    const { filter, since } = req.body || {};

    let logs = [...consoleLogs];

    // Filter by type if specified (error, warn, log, info, pageerror, network-error)
    if (filter) {
      const filterTypes = Array.isArray(filter) ? filter : [filter];
      logs = logs.filter(l => filterTypes.includes(l.type));
    }

    // Filter by timestamp if specified
    if (since) {
      const sinceTime = new Date(since).getTime();
      logs = logs.filter(l => new Date(l.timestamp).getTime() > sinceTime);
    }

    // Separate by severity for convenience
    const errors = logs.filter(l => ['error', 'pageerror', 'network-error'].includes(l.type));
    const warnings = logs.filter(l => l.type === 'warning' || l.type === 'warn');
    const info = logs.filter(l => !['error', 'pageerror', 'network-error', 'warning', 'warn'].includes(l.type));

    res.json({
      success: true,
      total: logs.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      logs,
      errors,
      warnings,
      hasErrors: errors.length > 0,
      hasWarnings: warnings.length > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get ONLY errors (shortcut)
router.post('/console-errors', express.json(), async (req, res) => {
  try {
    const errors = consoleLogs.filter(l =>
      ['error', 'pageerror', 'network-error'].includes(l.type)
    );

    res.json({
      success: true,
      count: errors.length,
      errors,
      hasErrors: errors.length > 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear console logs
router.post('/console-clear', express.json(), async (req, res) => {
  try {
    const previousCount = consoleLogs.length;
    consoleLogs = [];

    res.json({
      success: true,
      message: `Cleared ${previousCount} console entries`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hover over element
router.post('/hover', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector } = req.body;
    await testPage.hover(selector);
    await new Promise(resolve => setTimeout(resolve, 300));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Press keyboard key
router.post('/press', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { key } = req.body;
    await testPage.keyboard.press(key);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get element attribute or property
router.post('/get-attribute', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector, attribute } = req.body;
    const value = await testPage.$eval(selector, (el, attr) => {
      return el.getAttribute(attr) || el[attr];
    }, attribute);

    res.json({ success: true, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Count elements matching selector
router.post('/count', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { selector } = req.body;
    const count = await testPage.$$eval(selector, els => els.length);

    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FAST ELEMENT SEARCH - для быстрого поиска
// ============================================

// FIND - быстрый поиск элемента по тексту, возвращает готовый селектор
router.post('/find', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session. Call /test/start first' });
    }

    const { text, type, near } = req.body;
    // text - искать по тексту
    // type - тип элемента: button, link, input, any
    // near - искать рядом с элементом (label)

    const found = await testPage.evaluate(({ text, type, near }) => {
      const results = [];

      // Генерация уникального селектора
      const getUniqueSelector = (el) => {
        if (el.id) return `#${el.id}`;
        if (el.name) return `[name="${el.name}"]`;
        if (el.dataset.testid) return `[data-testid="${el.dataset.testid}"]`;
        if (el.placeholder) return `[placeholder="${el.placeholder}"]`;

        // Для кнопок - по тексту
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
          const btnText = el.textContent?.trim();
          if (btnText && btnText.length < 50) {
            return `text=${btnText}`;
          }
        }

        // По классам
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.split(' ').filter(c => c && !c.includes(':'))[0];
          if (classes) {
            const tag = el.tagName.toLowerCase();
            return `${tag}.${classes}`;
          }
        }

        return el.tagName.toLowerCase();
      };

      // Определяем какие элементы искать
      let selectors = [];
      if (type === 'button' || !type) {
        selectors.push('button', '[role="button"]', 'input[type="submit"]', 'input[type="button"]', 'a.btn', 'a.button');
      }
      if (type === 'link' || !type) {
        selectors.push('a[href]');
      }
      if (type === 'input' || !type) {
        selectors.push('input:not([type="hidden"])', 'textarea', 'select');
      }
      if (type === 'any') {
        selectors = ['*'];
      }

      const searchText = text?.toLowerCase() || '';

      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          if (el.offsetParent === null) return; // невидимый

          const elText = (el.textContent || el.value || el.placeholder || el.title || '').toLowerCase();
          const label = el.labels?.[0]?.textContent?.toLowerCase() || '';
          const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';

          // Поиск по тексту
          if (searchText && (
            elText.includes(searchText) ||
            label.includes(searchText) ||
            ariaLabel.includes(searchText)
          )) {
            results.push({
              selector: getUniqueSelector(el),
              text: el.textContent?.trim().slice(0, 50) || el.value || '',
              tag: el.tagName.toLowerCase(),
              type: el.type || '',
              placeholder: el.placeholder || ''
            });
          }
        });
      });

      return results.slice(0, 10); // макс 10 результатов
    }, { text, type, near });

    if (found.length === 0) {
      return res.json({
        success: false,
        message: `Element with text "${text}" not found`,
        suggestions: 'Try /test/ui-map to see all elements'
      });
    }

    // Если нашли ровно один - сразу даём селектор
    if (found.length === 1) {
      return res.json({
        success: true,
        found: true,
        selector: found[0].selector,
        element: found[0]
      });
    }

    // Если несколько - даём список
    res.json({
      success: true,
      found: true,
      count: found.length,
      message: 'Multiple matches, pick one:',
      elements: found
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UI-MAP - полная карта UI в удобном формате для Claude
router.post('/ui-map', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session. Call /test/start first' });
    }

    const uiMap = await testPage.evaluate(() => {
      const map = {
        page: {
          url: window.location.href,
          title: document.title
        },
        buttons: [],
        forms: [],
        inputs: [],
        links: [],
        modals: []
      };

      // Кнопки - самое важное!
      document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a.btn, a.button, .btn').forEach(el => {
        if (el.offsetParent === null) return;
        const text = el.textContent?.trim() || el.value || '';
        if (!text) return;

        map.buttons.push({
          text: text.slice(0, 40),
          selector: el.id ? `#${el.id}` :
                    el.name ? `[name="${el.name}"]` :
                    `text=${text.slice(0, 30)}`,
          disabled: el.disabled || false
        });
      });

      // Формы
      document.querySelectorAll('form').forEach((form, i) => {
        const formInfo = {
          selector: form.id ? `#${form.id}` : `form:nth-of-type(${i + 1})`,
          action: form.action || '',
          fields: []
        };

        form.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(field => {
          if (field.offsetParent === null) return;
          const label = field.labels?.[0]?.textContent?.trim() || field.placeholder || field.name || '';
          formInfo.fields.push({
            label: label.slice(0, 30),
            selector: field.id ? `#${field.id}` :
                      field.name ? `[name="${field.name}"]` :
                      field.placeholder ? `[placeholder="${field.placeholder}"]` :
                      field.tagName.toLowerCase(),
            type: field.type || field.tagName.toLowerCase(),
            required: field.required || false
          });
        });

        if (formInfo.fields.length > 0) {
          map.forms.push(formInfo);
        }
      });

      // Отдельные инпуты (вне форм)
      document.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(el => {
        if (el.offsetParent === null || el.closest('form')) return;
        const label = el.labels?.[0]?.textContent?.trim() || el.placeholder || el.name || '';
        map.inputs.push({
          label: label.slice(0, 30),
          selector: el.id ? `#${el.id}` :
                    el.name ? `[name="${el.name}"]` :
                    el.placeholder ? `[placeholder="${el.placeholder}"]` :
                    el.tagName.toLowerCase(),
          type: el.type || el.tagName.toLowerCase()
        });
      });

      // Навигационные ссылки
      document.querySelectorAll('nav a, header a, .menu a, .nav a').forEach(el => {
        if (el.offsetParent === null) return;
        const text = el.textContent?.trim();
        if (!text || text.length > 50) return;
        map.links.push({
          text: text,
          href: el.getAttribute('href') || '',
          selector: `text=${text}`
        });
      });

      // Модальные окна
      document.querySelectorAll('.modal, [role="dialog"], .popup, .overlay').forEach(el => {
        const isVisible = window.getComputedStyle(el).display !== 'none' &&
                          window.getComputedStyle(el).visibility !== 'hidden' &&
                          window.getComputedStyle(el).opacity !== '0';
        map.modals.push({
          selector: el.id ? `#${el.id}` : el.className.split(' ')[0] ? `.${el.className.split(' ')[0]}` : 'modal',
          visible: isVisible
        });
      });

      return map;
    });

    // Форматируем для быстрого чтения
    let quickRef = `## UI MAP: ${uiMap.page.title}\n`;
    quickRef += `URL: ${uiMap.page.url}\n\n`;

    if (uiMap.buttons.length) {
      quickRef += `### BUTTONS (${uiMap.buttons.length}):\n`;
      uiMap.buttons.slice(0, 15).forEach(b => {
        quickRef += `  "${b.text}" → ${b.selector}${b.disabled ? ' [DISABLED]' : ''}\n`;
      });
    }

    if (uiMap.forms.length) {
      quickRef += `\n### FORMS (${uiMap.forms.length}):\n`;
      uiMap.forms.forEach(f => {
        quickRef += `  ${f.selector}:\n`;
        f.fields.slice(0, 10).forEach(field => {
          quickRef += `    "${field.label}" → ${field.selector} (${field.type})${field.required ? ' *' : ''}\n`;
        });
      });
    }

    if (uiMap.inputs.length) {
      quickRef += `\n### INPUTS (${uiMap.inputs.length}):\n`;
      uiMap.inputs.slice(0, 10).forEach(inp => {
        quickRef += `  "${inp.label}" → ${inp.selector} (${inp.type})\n`;
      });
    }

    res.json({
      success: true,
      quickRef,  // Текстовый формат для быстрого чтения
      map: uiMap // Структурированные данные
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CLICK-TEXT - клик по тексту кнопки (самый быстрый способ)
router.post('/click-text', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { text } = req.body;
    lastAction = `Click: "${text}"`;
    lastActionTime = Date.now();

    const clicked = await testPage.evaluate((searchText) => {
      const elements = [...document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"], .btn, .button')];
      const el = elements.find(e => {
        const elText = (e.textContent || e.value || '').trim().toLowerCase();
        return elText.includes(searchText.toLowerCase());
      });

      if (el) {
        el.click();
        return { found: true, text: el.textContent?.trim() || el.value };
      }
      return { found: false };
    }, text);

    if (!clicked.found) {
      return res.json({ success: false, error: `Button with text "${text}" not found` });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    res.json({ success: true, clicked: clicked.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// FILL-FORM - заполнить форму одним запросом
router.post('/fill-form', express.json(), async (req, res) => {
  try {
    if (!testPage) {
      return res.status(400).json({ error: 'No test session' });
    }

    const { formSelector, fields } = req.body;
    // fields: { "fieldName": "value", ... } или { "placeholder": "value", ... }

    const results = await testPage.evaluate(({ formSelector, fields }) => {
      const form = formSelector ? document.querySelector(formSelector) : document.querySelector('form');
      if (!form) return { error: 'Form not found' };

      const filled = [];
      for (const [key, value] of Object.entries(fields)) {
        // Ищем поле по разным атрибутам
        let field = form.querySelector(`[name="${key}"]`) ||
                    form.querySelector(`#${key}`) ||
                    form.querySelector(`[placeholder*="${key}" i]`) ||
                    form.querySelector(`[aria-label*="${key}" i]`);

        // Ищем по label
        if (!field) {
          const labels = form.querySelectorAll('label');
          labels.forEach(label => {
            if (label.textContent.toLowerCase().includes(key.toLowerCase())) {
              field = label.control || form.querySelector(`#${label.getAttribute('for')}`);
            }
          });
        }

        if (field) {
          if (field.type === 'checkbox' || field.type === 'radio') {
            field.checked = !!value;
          } else if (field.tagName === 'SELECT') {
            field.value = value;
          } else {
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
          }
          filled.push(key);
        }
      }

      return { success: true, filled };
    }, { formSelector, fields });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
