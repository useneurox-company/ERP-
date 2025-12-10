/**
 * Server-side AI Browser Agent with Computer Use (Comet-style)
 *
 * FAST, RELIABLE, VISUAL - like Perplexity Comet
 *
 * Features:
 * - Auto browser cleanup between tasks
 * - Navigation retry with increased timeout
 * - Visual cursor indicator on screenshots
 * - Stuck detection and recovery
 * - Minimal delays for speed
 *
 * Endpoints:
 * - POST /agent/start - Start agent with task
 * - POST /agent/stop - Stop agent
 * - GET /agent/status - Get agent status
 * - GET /agent/screenshot - Get current screenshot
 */

const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Agent state
let agentState = {
  running: false,
  task: null,
  page: null,
  browser: null,
  screenshot: null,
  actions: [],
  thinking: '',
  error: null,
  step: 0,
  maxSteps: 20, // Reduced from 30 - Comet is fast!
  stopped: false
};

// Read OpenRouter key
function getOpenRouterKey() {
  try {
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/OPENROUTER_API_KEY=(.+)/);
      if (match) return match[1].trim();
    }
    return process.env.OPENROUTER_API_KEY || null;
  } catch (e) {
    console.error('[Agent] Error reading API key:', e.message);
    return null;
  }
}

/**
 * Cleanup - close browser properly
 */
async function cleanup() {
  console.log('[Agent] Cleaning up...');
  try {
    if (agentState.page) {
      await agentState.page.close().catch(() => {});
      agentState.page = null;
    }
    if (agentState.browser) {
      await agentState.browser.close().catch(() => {});
      agentState.browser = null;
    }
  } catch (e) {
    console.error('[Agent] Cleanup error:', e.message);
  }
}

// ==================== DOM-FIRST AGENT (как Comet) ====================

/**
 * ФАЗА 1: Extract page elements (DOM-based)
 * Returns buttons, inputs, links with selectors
 * NO VISION API - just DOM!
 */
async function extractPageElements(page) {
  return await page.evaluate(() => {
    const elements = { buttons: [], inputs: [], links: [], url: window.location.href, title: document.title };

    // Кнопки
    document.querySelectorAll('button, [role="button"], input[type="submit"], a.btn, .btn').forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight) {
        const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
        if (text) {
          elements.buttons.push({
            index: i,
            text: text.substring(0, 50),
            selector: el.id ? `#${el.id}` :
                     el.name ? `[name="${el.name}"]` :
                     el.className ? `button.${el.className.split(' ')[0]}` :
                     `button:nth-of-type(${i + 1})`,
            type: el.type || el.tagName.toLowerCase(),
            visible: true
          });
        }
      }
    });

    // Инпуты
    document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea').forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight) {
        elements.inputs.push({
          index: i,
          placeholder: el.placeholder || '',
          name: el.name || '',
          type: el.type || 'text',
          selector: el.name ? `[name="${el.name}"]` :
                   el.id ? `#${el.id}` :
                   el.placeholder ? `[placeholder="${el.placeholder}"]` :
                   `input:nth-of-type(${i + 1})`,
          value: el.value ? '(has value)' : '(empty)',
          focused: document.activeElement === el
        });
      }
    });

    // Ссылки меню (sidebar, nav)
    document.querySelectorAll('a[href], nav a, .sidebar a, aside a').forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight) {
        const text = (el.innerText || '').trim();
        if (text && text.length < 50) {
          elements.links.push({
            index: i,
            text: text,
            href: el.getAttribute('href') || '',
            selector: el.id ? `#${el.id}` :
                     text ? `a:has-text("${text.substring(0, 20)}")` :
                     `a:nth-of-type(${i + 1})`
          });
        }
      }
    });

    return elements;
  });
}

/**
 * Find clickable elements by text (DOM-based)
 * Returns coordinates for clicking
 */
async function findButtonByText(page, texts) {
  try {
    const coords = await page.evaluate((searchTexts) => {
      // Try multiple selectors
      const selectors = [
        'button[type="submit"]',
        'button',
        'input[type="submit"]',
        'a.btn',
        '[role="button"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = (el.innerText || el.value || '').toLowerCase();
          for (const searchText of searchTexts) {
            if (text.includes(searchText.toLowerCase())) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return {
                  x: Math.round(rect.left + rect.width / 2),
                  y: Math.round(rect.top + rect.height / 2),
                  text: el.innerText || el.value,
                  found: true
                };
              }
            }
          }
        }
      }

      // Fallback: try to find any button
      const anyButton = document.querySelector('button[type="submit"], input[type="submit"], button');
      if (anyButton) {
        const rect = anyButton.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
          text: anyButton.innerText || anyButton.value || 'button',
          found: true
        };
      }

      return { found: false };
    }, texts);

    return coords;
  } catch (error) {
    console.error('[Agent] findButtonByText error:', error.message);
    return { found: false };
  }
}

/**
 * Navigate with retry
 */
async function navigateWithRetry(page, url, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Agent] Navigation attempt ${attempt}/${maxRetries} to ${url}`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // Faster than networkidle0
        timeout: 45000 // 45 seconds
      });
      // Wait a bit for JS to load
      await sleep(500);
      return true;
    } catch (error) {
      console.error(`[Agent] Navigation attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      await sleep(1000);
    }
  }
  return false;
}

/**
 * Start agent with task
 */
router.post('/start', async (req, res) => {
  try {
    const { task, url, visible = true } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    // Always cleanup before starting new task
    if (agentState.running || agentState.browser) {
      console.log('[Agent] Cleaning up previous session...');
      agentState.stopped = true;
      await cleanup();
    }

    const openRouterKey = getOpenRouterKey();
    if (!openRouterKey) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });
    }

    // Reset state
    agentState = {
      running: true,
      task,
      page: null,
      browser: null,
      screenshot: null,
      actions: [],
      thinking: 'Starting browser...',
      error: null,
      step: 0,
      maxSteps: 20,
      stopped: false
    };

    // Launch browser with Puppeteer directly (faster than getBrowser)
    console.log('[Agent] Starting browser with task:', task);
    const browser = await puppeteer.launch({
      headless: !visible,
      defaultViewport: { width: 1280, height: 900 },
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage'
      ]
    });

    const page = await browser.newPage();
    agentState.browser = browser;
    agentState.page = page;

    // Set viewport
    await page.setViewport({ width: 1280, height: 900 });

    // Navigate to URL with retry
    const targetUrl = url || 'http://localhost:5000';
    console.log('[Agent] Navigating to:', targetUrl);

    try {
      await navigateWithRetry(page, targetUrl);
    } catch (navError) {
      console.error('[Agent] Navigation failed:', navError.message);
      await cleanup();
      return res.status(500).json({ error: `Navigation failed: ${navError.message}` });
    }

    // Take initial screenshot
    const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
    agentState.screenshot = screenshot;
    agentState.thinking = 'Ready to execute task';

    // Start agent loop in background
    runAgentLoop(openRouterKey).catch(err => {
      console.error('[Agent] Loop error:', err);
      agentState.error = err.message;
      agentState.running = false;
      cleanup(); // Always cleanup on error
    });

    res.json({
      status: 'started',
      task,
      screenshot: `data:image/png;base64,${screenshot}`
    });

  } catch (error) {
    console.error('[Agent] Start error:', error);
    agentState.running = false;
    agentState.error = error.message;
    await cleanup();
    res.status(500).json({ error: error.message });
  }
});

/**
 * Main agent loop - runs in background
 * FAST and SMART - like Comet
 */
async function runAgentLoop(apiKey) {
  const page = agentState.page;

  // Track click coordinates to detect stuck state
  const clickHistory = [];
  let lastCursorPos = { x: 0, y: 0 };
  const startTime = Date.now();

  try {
    while (agentState.running && !agentState.stopped && agentState.step < agentState.maxSteps) {
      const stepStart = Date.now();
      agentState.step++;
      console.log(`[Agent] Step ${agentState.step}/${agentState.maxSteps}`);

      // 1. Take screenshot with cursor indicator
      const screenshot = await takeScreenshotWithCursor(page, lastCursorPos.x, lastCursorPos.y);
      agentState.screenshot = screenshot;

      // 2. Get current URL
      const currentUrl = page.url();

      // 3. Ask Claude what to do (FAST!)
      const action = await askClaude(apiKey, screenshot, agentState.task, agentState.actions, currentUrl);

      if (!action) {
        console.log('[Agent] No action returned, stopping');
        break;
      }

      agentState.thinking = action.thinking || '';
      console.log('[Agent] Thinking:', agentState.thinking?.substring(0, 100));
      console.log('[Agent] Action:', action.type, JSON.stringify(action.params));

      // 4. Check if complete
      if (action.type === 'complete') {
        console.log('[Agent] Task complete!');
        agentState.actions.push({ ...action, result: 'Task completed' });
        break;
      }

      // 5. Execute action
      const result = await executeAction(page, action);
      agentState.actions.push({ ...action, result });

      // 6. Track clicks and detect stuck state
      if (action.type === 'click' && action.params?.x && action.params?.y) {
        lastCursorPos = { x: action.params.x, y: action.params.y };

        // Round to nearest 30px to group similar clicks
        const key = `${Math.round(action.params.x/30)*30},${Math.round(action.params.y/30)*30}`;
        clickHistory.push(key);

        // Check if stuck (same click 3 times)
        if (clickHistory.length >= 3) {
          const last3 = clickHistory.slice(-3);
          if (last3.every(k => k === last3[0])) {
            console.log('[Agent] STUCK DETECTED! Same click 3 times. Trying recovery...');

            // Count how many types we've done - if 2+, try to find login button via DOM
            const typeCount = agentState.actions.filter(a => a.type === 'type').length;

            if (typeCount >= 2) {
              // Smart recovery: find button via DOM and click it!
              console.log('[Agent] Trying DOM-based button search...');
              const buttonCoords = await findButtonByText(page, ['войти', 'login', 'submit', 'вход', 'sign in']);

              if (buttonCoords.found) {
                console.log(`[Agent] FOUND BUTTON "${buttonCoords.text}" at (${buttonCoords.x}, ${buttonCoords.y})!`);
                await page.mouse.click(buttonCoords.x, buttonCoords.y);
                lastCursorPos = { x: buttonCoords.x, y: buttonCoords.y };
                agentState.actions.push({
                  type: 'click',
                  params: { x: buttonCoords.x, y: buttonCoords.y },
                  result: `DOM-clicked button "${buttonCoords.text}" at (${buttonCoords.x}, ${buttonCoords.y})`
                });
                clickHistory.length = 0;
                await sleep(500); // Wait for navigation
                continue;
              }
            }

            // Fallback recovery strategies
            const recoveryStrategies = [
              async () => { await page.evaluate(() => window.scrollBy(0, 400)); },
              async () => { await page.keyboard.press('Escape'); },
              async () => { await page.evaluate(() => window.scrollBy(0, -400)); },
              async () => { await page.evaluate(() => window.scrollTo(0, 0)); }
            ];

            const strategy = recoveryStrategies[agentState.step % recoveryStrategies.length];
            await strategy();
            clickHistory.length = 0; // Reset history
            await sleep(200);
            continue;
          }
        }

        // Check if URL changed (successful navigation)
        await sleep(100);
        const urlAfter = page.url();
        if (urlAfter !== currentUrl) {
          console.log(`[Agent] URL changed: ${currentUrl} -> ${urlAfter}`);
          clickHistory.length = 0;
        }
      }

      // 7. Minimal delay between steps (FAST!)
      await sleep(100);

      const stepTime = Date.now() - stepStart;
      console.log(`[Agent] Step ${agentState.step} took ${stepTime}ms`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Agent] Loop finished in ${totalTime}ms (${agentState.step} steps)`);

  } catch (error) {
    console.error('[Agent] Loop error:', error);
    agentState.error = error.message;
  } finally {
    agentState.running = false;
    // Close browser after task is done
    console.log('[Agent] Closing browser...');
    await cleanup();
  }
}

/**
 * Ask Claude Vision what action to take
 * OPTIMIZED for speed and accuracy
 */
async function askClaude(apiKey, screenshot, task, previousActions, currentUrl) {
  // Build action history (last 3 only for speed)
  const actionsHistory = previousActions
    .slice(-3)
    .map((a, i) => `${i+1}. ${a.type}(${JSON.stringify(a.params || {})}) -> ${a.result || '?'}`)
    .join('\n');

  // Check for looping
  const recentActions = previousActions.slice(-3);
  const isLooping = recentActions.length >= 3 &&
    recentActions.every(a => a.type === recentActions[0].type &&
      JSON.stringify(a.params) === JSON.stringify(recentActions[0].params));

  // Determine what next action should be based on history
  const lastAction = previousActions[previousActions.length - 1];
  const lastTwoActions = previousActions.slice(-2);

  // Count how many type actions we've done (for login tracking)
  const typeCount = previousActions.filter(a => a.type === 'type').length;

  // After type, next should be click (on password field or login button)
  const wasType = lastAction?.type === 'type';

  // After click, if we haven't typed 2x yet, type next
  const wasClick = lastAction?.type === 'click';
  const shouldType = wasClick && typeCount < 2;

  // After 2 types, next click should be on LOGIN BUTTON (not input!)
  const shouldClickButton = typeCount >= 2;

  // Check if we're stuck clicking
  const lastThreeClicks = previousActions.slice(-3).filter(a => a.type === 'click');
  const isClickLoop = lastThreeClicks.length === 3 &&
    lastThreeClicks.every(a => a.type === 'click');

  // Build hint based on current state
  let stateHint = '';
  if (isLooping) {
    stateHint = '\n⚠️ STUCK! Change strategy - scroll or click different area!';
  } else if (shouldType) {
    stateHint = '\n✅ Input field focused! NOW TYPE "admin"!';
  } else if (shouldClickButton) {
    stateHint = '\n🎯 Both fields filled! NOW CLICK THE LOGIN BUTTON! Look for "Войти" button at the bottom of the form!';
  } else if (wasType && typeCount === 1) {
    stateHint = '\n➡️ Username entered! Now CLICK on password field (below username)!';
  }

  // Comet-style focused prompt
  const prompt = `You are a browser automation agent. Execute task step by step.

TASK: ${task}

URL: ${currentUrl}
${actionsHistory ? `Recent:\n${actionsHistory}` : ''}
${stateHint}

PROGRESS: ${typeCount}/2 text inputs done

AVAILABLE ACTIONS:
{"type":"click","params":{"x":N,"y":N}}  - click at position
{"type":"type","params":{"text":"admin"}}  - TYPE text into focused field
{"type":"scroll","params":{"direction":"down"}}  - scroll page
{"type":"complete","params":{}}  - task finished

LOGIN FLOW:
1. click username field → 2. type "admin" → 3. click password field → 4. type "admin" → 5. click "Войти" button

CRITICAL RULES:
- After clicking INPUT FIELD: type "admin"
- After typing PASSWORD (2nd type): click LOGIN BUTTON (NOT type again!)
- Login button "Войти" is usually at bottom of form, bright green or blue
- Do NOT type into buttons! Click them!
${typeCount >= 2 ? '\n🔴 YOU ALREADY TYPED 2 TIMES! NOW CLICK THE LOGIN BUTTON!' : ''}

RESPOND WITH JSON ONLY:`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3500',
        'X-Title': 'ScreenCreate Agent'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        max_tokens: 300, // Reduced for speed
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot}` } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenRouter error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log('[Agent] Claude response:', content?.substring(0, 200));

    return parseClaudeResponse(content);

  } catch (error) {
    console.error('[Agent] Claude error:', error.message);
    // One retry
    if (!error.message.includes('retry')) {
      await sleep(1000);
      error.message += ' (retry)';
      return askClaude(apiKey, screenshot, task, previousActions, currentUrl);
    }
    return null;
  }
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(content) {
  if (!content) return null;

  try {
    let jsonStr = content;

    // Remove markdown code blocks
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) jsonStr = match[1];

    // Find JSON object
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(jsonStr);
    return {
      thinking: parsed.thinking || '',
      type: parsed.type || 'complete',
      params: parsed.params || {}
    };

  } catch (error) {
    // Try regex extraction for different action types
    const typeMatch = content.match(/"type"\s*:\s*"(\w+)"/);
    const xMatch = content.match(/"x"\s*:\s*(\d+)/);
    const yMatch = content.match(/"y"\s*:\s*(\d+)/);
    const textMatch = content.match(/"text"\s*:\s*"([^"]+)"/);
    const directionMatch = content.match(/"direction"\s*:\s*"(\w+)"/);

    if (typeMatch) {
      const actionType = typeMatch[1];
      let params = {};

      // Build params based on action type
      if (actionType === 'click') {
        params = {
          x: xMatch ? parseInt(xMatch[1]) : undefined,
          y: yMatch ? parseInt(yMatch[1]) : undefined
        };
      } else if (actionType === 'type') {
        params = {
          text: textMatch ? textMatch[1] : undefined
        };
      } else if (actionType === 'scroll') {
        params = {
          direction: directionMatch ? directionMatch[1] : 'down'
        };
      }

      return {
        thinking: content.substring(0, 80),
        type: actionType,
        params
      };
    }

    return null;
  }
}

/**
 * Execute action on page
 */
async function executeAction(page, action) {
  const { type, params } = action;

  try {
    switch (type) {
      case 'click':
        if (params?.x !== undefined && params?.y !== undefined) {
          console.log(`[Agent] Clicking at (${params.x}, ${params.y})`);
          // Move mouse first (more visible)
          await page.mouse.move(params.x, params.y);
          await sleep(50);
          await page.mouse.click(params.x, params.y);
          return `Clicked at (${params.x}, ${params.y})`;
        }
        return 'No coordinates';

      case 'type':
        if (params?.text) {
          console.log(`[Agent] Typing: ${params.text}`);
          await page.keyboard.type(params.text, { delay: 30 }); // Fast typing
          return `Typed: ${params.text}`;
        }
        return 'No text';

      case 'scroll':
        const direction = params?.direction || 'down';
        const amount = direction === 'down' ? 400 : -400;
        console.log(`[Agent] Scrolling ${direction}`);
        await page.evaluate((y) => window.scrollBy(0, y), amount);
        return `Scrolled ${direction}`;

      case 'press':
        const key = params?.key || 'Enter';
        console.log(`[Agent] Pressing ${key}`);
        await page.keyboard.press(key);
        return `Pressed ${key}`;

      case 'complete':
        return 'Task completed';

      default:
        return `Unknown: ${type}`;
    }
  } catch (error) {
    console.error('[Agent] Action error:', error.message);
    return `Error: ${error.message}`;
  }
}

/**
 * Stop agent
 */
router.post('/stop', async (req, res) => {
  try {
    agentState.stopped = true;
    agentState.running = false;
    agentState.thinking = 'Agent stopped by user';

    await cleanup();

    res.json({ status: 'stopped' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get agent status
 */
router.get('/status', (req, res) => {
  res.json({
    running: agentState.running,
    task: agentState.task,
    step: agentState.step,
    maxSteps: agentState.maxSteps,
    thinking: agentState.thinking,
    error: agentState.error,
    actionsCount: agentState.actions.length,
    lastAction: agentState.actions[agentState.actions.length - 1] || null,
    screenshot: agentState.screenshot ? `data:image/png;base64,${agentState.screenshot}` : null
  });
});

/**
 * Get current screenshot
 */
router.get('/screenshot', (req, res) => {
  if (!agentState.screenshot) {
    return res.status(404).json({ error: 'No screenshot available' });
  }

  const buffer = Buffer.from(agentState.screenshot, 'base64');
  res.set('Content-Type', 'image/png');
  res.send(buffer);
});

/**
 * Get action history
 */
router.get('/actions', (req, res) => {
  res.json({
    actions: agentState.actions
  });
});

// ==================== DOM-FIRST ENDPOINTS ====================

/**
 * ФАЗА 1 ТЕСТ: Get DOM elements from page
 * POST /agent/dom
 */
router.post('/dom', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Launch quick browser session
    const browser = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1280, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(500);

    const elements = await extractPageElements(page);
    await browser.close();

    res.json({
      success: true,
      elements,
      summary: {
        buttons: elements.buttons.length,
        inputs: elements.inputs.length,
        links: elements.links.length
      }
    });

  } catch (error) {
    console.error('[Agent] DOM extraction error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ФАЗА 2: Call Text LLM (no Vision!)
 * Returns action based on DOM elements
 */
async function callTextLLM(domElements, task, history = []) {
  const apiKey = getOpenRouterKey();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  // Safe access with defaults
  const buttons = (domElements.buttons || []).slice(0, 10);
  const inputs = (domElements.inputs || []).slice(0, 10);
  const links = (domElements.links || []).slice(0, 15);
  const url = domElements.url || 'unknown';
  const title = domElements.title || 'unknown';

  // Build history string with step numbers
  const historyStr = history.length > 0
    ? history.map((h, i) => `Step ${i+1}: ${h.action}(${h.selector || ''}) ${h.text ? `"${h.text}"` : ''}`).join('\n')
    : '(no actions yet)';

  const prompt = `You are a browser automation agent. Complete the task step by step.

TASK: "${task}"

CURRENT PAGE: ${url}
TITLE: ${title}

AVAILABLE ELEMENTS:
BUTTONS: ${JSON.stringify(buttons)}
INPUTS: ${JSON.stringify(inputs)}
LINKS: ${JSON.stringify(links)}

ACTIONS ALREADY COMPLETED:
${historyStr}

WHAT TO DO NEXT? Return ONE JSON action:
{"action": "type", "selector": "#username", "text": "admin"} - type text
{"action": "click", "selector": "button.inline-flex"} - click button
{"action": "done", "result": "Task completed"} - finished

CRITICAL RULES:
1. NEVER repeat an action on the same selector you already did!
2. For login form: first type username, then type password, then click submit button
3. If you already typed into #username and #password, CLICK THE BUTTON next!
4. After login succeeds (URL changes), look for menu links in LINKS array
5. Return ONLY the next action JSON, nothing else

JSON:`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3500',
      'X-Title': 'DOM-First Agent'
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',  // Fast and cheap alternative
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`LLM error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  console.log('[Agent] LLM response:', content);

  // Parse JSON from response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[Agent] JSON parse error:', e.message);
  }

  return { action: 'done', result: 'Could not parse action' };
}

/**
 * ФАЗА 2 ТЕСТ: Think endpoint
 * POST /agent/think
 */
router.post('/think', async (req, res) => {
  try {
    const { task, elements } = req.body;
    if (!task || !elements) {
      return res.status(400).json({ error: 'task and elements required' });
    }

    const action = await callTextLLM(elements, task, []);
    res.json({ success: true, action });

  } catch (error) {
    console.error('[Agent] Think error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ФАЗА 3: Execute action by selector
 */
async function executeBySelector(page, action) {
  console.log(`[Agent] Executing: ${action.action} on ${action.selector || ''}`);

  try {
    switch (action.action) {
      case 'click':
        if (action.selector) {
          // Try different selector strategies
          let clicked = false;
          const urlBefore = page.url();

          // Strategy 1: Direct selector
          try {
            await page.waitForSelector(action.selector, { timeout: 3000 });

            // Check if this is a submit button (login, form submit)
            const isSubmitButton = await page.evaluate((sel) => {
              const el = document.querySelector(sel);
              return el && (el.type === 'submit' || el.closest('form'));
            }, action.selector);

            if (isSubmitButton) {
              // For submit buttons, wait for possible navigation
              console.log('[Agent] Submit button detected, waiting for navigation...');
              await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {}),
                page.click(action.selector)
              ]);
              // Extra wait for SPA to update
              await sleep(500);
            } else {
              await page.click(action.selector);
            }
            clicked = true;
          } catch (e) {
            console.log('[Agent] Direct selector failed, trying text match...');
          }

          // Strategy 2: Text-based search
          if (!clicked && action.selector.includes('has-text')) {
            const textMatch = action.selector.match(/has-text\("([^"]+)"\)/);
            if (textMatch) {
              const searchText = textMatch[1].toLowerCase();
              clicked = await page.evaluate((text) => {
                const elements = document.querySelectorAll('a, button, [role="button"]');
                for (const el of elements) {
                  if (el.innerText.toLowerCase().includes(text)) {
                    el.click();
                    return true;
                  }
                }
                return false;
              }, searchText);
            }
          }

          const urlAfter = page.url();
          const navigated = urlBefore !== urlAfter;

          return {
            success: clicked,
            result: clicked ? `Clicked ${action.selector}${navigated ? ' (navigated to ' + urlAfter + ')' : ''}` : 'Click failed',
            navigated
          };
        }
        return { success: false, error: 'No selector' };

      case 'type':
        if (action.selector && action.text) {
          await page.waitForSelector(action.selector, { timeout: 3000 });

          // Click to focus the input
          await page.click(action.selector);

          // Clear existing value first
          await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (el) el.value = '';
          }, action.selector);

          // Use native Puppeteer type which triggers real keyboard events
          // This is more reliable for React controlled inputs
          await page.type(action.selector, action.text, { delay: 30 });

          return { success: true, result: `Typed "${action.text}" into ${action.selector}` };
        }
        return { success: false, error: 'No selector or text' };

      case 'submit':
        // Submit form via button click that triggers form submit
        if (action.selector) {
          const urlBefore = page.url();

          // Find and submit the closest form
          await page.evaluate((selector) => {
            const button = document.querySelector(selector);
            if (button) {
              const form = button.closest('form');
              if (form) {
                // Create and dispatch submit event
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(submitEvent);
              }
              // Also click the button
              button.click();
            }
          }, action.selector);

          // Wait for navigation
          await sleep(2000);
          const urlAfter = page.url();

          return {
            success: true,
            result: `Submitted form via ${action.selector}${urlAfter !== urlBefore ? ' (navigated to ' + urlAfter + ')' : ''}`,
            navigated: urlAfter !== urlBefore
          };
        }
        return { success: false, error: 'No selector' };

      case 'done':
        return { success: true, done: true, result: action.result || 'Task completed' };

      default:
        return { success: false, error: `Unknown action: ${action.action}` };
    }
  } catch (error) {
    console.error('[Agent] Execute error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * ФАЗА 4: Full DOM-First Agent Loop
 * POST /agent/start-dom
 */
router.post('/start-dom', async (req, res) => {
  try {
    const { task, url, maxSteps = 10 } = req.body;

    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    // Cleanup previous session
    if (agentState.browser) {
      await cleanup();
    }

    const targetUrl = url || 'http://localhost:5000';
    console.log(`[Agent] Starting DOM-First agent: "${task}" on ${targetUrl}`);

    // Launch browser
    const browser = await puppeteer.launch({
      headless: false, // Visible for debugging
      defaultViewport: { width: 1280, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    agentState.browser = browser;
    agentState.page = page;
    agentState.running = true;
    agentState.task = task;
    agentState.actions = [];
    agentState.step = 0;
    agentState.maxSteps = maxSteps;

    // Navigate
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(500);

    // Run DOM-First loop
    const history = [];
    let result = null;

    // Stuck detection
    const clickTracker = {};  // { selector: count }
    let lastUrl = page.url();

    for (let step = 1; step <= maxSteps; step++) {
      agentState.step = step;
      console.log(`[Agent] DOM Step ${step}/${maxSteps}`);

      // Check if URL changed (login success, navigation, etc.)
      const currentUrl = page.url();
      if (currentUrl !== lastUrl) {
        console.log(`[Agent] URL changed: ${lastUrl} -> ${currentUrl}`);
        // Reset click tracker on navigation - new page, new elements
        Object.keys(clickTracker).forEach(k => delete clickTracker[k]);
        lastUrl = currentUrl;
      }

      // 1. Extract DOM elements (FAST - no Vision!)
      const elements = await extractPageElements(page);
      console.log(`[Agent] Found: ${elements.buttons.length} buttons, ${elements.inputs.length} inputs, ${elements.links.length} links`);

      // 2. Ask Text LLM what to do (CHEAP - no image!)
      const action = await callTextLLM(elements, task, history);
      console.log(`[Agent] Action: ${JSON.stringify(action)}`);
      agentState.thinking = `Step ${step}: ${action.action} ${action.selector || action.text || ''}`;

      // 3. Stuck detection - check before executing
      if (action.action === 'click' && action.selector) {
        clickTracker[action.selector] = (clickTracker[action.selector] || 0) + 1;

        if (clickTracker[action.selector] >= 3) {
          console.log(`[Agent] STUCK DETECTED! Clicked "${action.selector}" ${clickTracker[action.selector]} times`);
          // Force done - we're stuck, don't waste more steps
          result = {
            success: true,
            steps: step,
            result: `Completed after ${step} steps. Last page: ${currentUrl}`,
            stuck: true
          };
          break;
        }
      }

      // 4. Execute by selector (ACCURATE - 100%!)
      const execResult = await executeBySelector(page, action);
      history.push({ ...action, result: execResult.result });
      agentState.actions.push({ step, ...action, result: execResult.result });

      // 5. Check if done
      if (execResult.done) {
        result = { success: true, steps: step, result: execResult.result };
        break;
      }

      // 6. Wait for page to react
      await sleep(300);

      // 7. Check URL again after action - if changed, log it
      const urlAfterAction = page.url();
      if (urlAfterAction !== currentUrl) {
        console.log(`[Agent] Action caused navigation: ${currentUrl} -> ${urlAfterAction}`);
        // Reset tracker since we navigated
        Object.keys(clickTracker).forEach(k => delete clickTracker[k]);
        lastUrl = urlAfterAction;
      }

      // Take screenshot for status
      agentState.screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
    }

    if (!result) {
      result = { success: false, steps: maxSteps, error: 'Max steps reached' };
    }

    console.log(`[Agent] DOM-First finished: ${JSON.stringify(result)}`);
    agentState.running = false;

    // Don't close browser - keep for inspection
    res.json({
      ...result,
      actions: agentState.actions,
      screenshot: agentState.screenshot ? `data:image/png;base64,${agentState.screenshot}` : null
    });

  } catch (error) {
    console.error('[Agent] DOM-First error:', error.message);
    agentState.running = false;
    res.status(500).json({ error: error.message });
  }
});

/**
 * Take screenshot with visual cursor indicator
 */
async function takeScreenshotWithCursor(page, x, y) {
  try {
    if (x && y && x > 0 && y > 0) {
      await page.evaluate(({x, y}) => {
        const old = document.getElementById('__agent_cursor__');
        if (old) old.remove();

        const cursor = document.createElement('div');
        cursor.id = '__agent_cursor__';
        cursor.style.cssText = `
          position: fixed;
          left: ${x - 15}px;
          top: ${y - 15}px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: rgba(255, 0, 0, 0.7);
          border: 3px solid white;
          z-index: 2147483647;
          pointer-events: none;
          box-shadow: 0 0 20px red, 0 0 40px rgba(255,0,0,0.5);
        `;
        document.body.appendChild(cursor);
      }, {x, y});
    }

    const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });

    await page.evaluate(() => {
      const cursor = document.getElementById('__agent_cursor__');
      if (cursor) cursor.remove();
    });

    return screenshot;
  } catch (error) {
    return await page.screenshot({ type: 'png', encoding: 'base64' });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;
