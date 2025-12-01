const path = require('path');
const fs = require('fs').promises;

/**
 * Capture interactive states: hover, tabs, modals
 */
async function captureInteractive(page, options) {
  const {
    screenshotsDir,
    fileName,
    format = 'png',
    captureHover = false,
    captureTabs = false,
    captureModals = false,
    compressForAI = false,
    optimizeForAI = null
  } = options;

  const interactiveDir = path.join(screenshotsDir, 'interactive');
  const results = [];

  // Capture hover states
  if (captureHover) {
    const hoverResults = await captureHoverStates(page, {
      dir: interactiveDir,
      fileName,
      format,
      compressForAI,
      optimizeForAI
    });
    results.push(...hoverResults);
  }

  // Capture tabs/accordions
  if (captureTabs) {
    const tabResults = await captureTabStates(page, {
      dir: interactiveDir,
      fileName,
      format,
      compressForAI,
      optimizeForAI
    });
    results.push(...tabResults);
  }

  // Capture modals
  if (captureModals) {
    const modalResults = await captureModalStates(page, {
      dir: interactiveDir,
      fileName,
      format,
      compressForAI,
      optimizeForAI
    });
    results.push(...modalResults);
  }

  return results;
}

/**
 * Find and capture hover states on buttons and links
 */
async function captureHoverStates(page, options) {
  const { dir, fileName, format, compressForAI, optimizeForAI } = options;
  const results = [];

  try {
    // Find interactive elements
    const elements = await page.$$eval('button, a.btn, .button, [role="button"]', els =>
      els.slice(0, 5).map((el, i) => ({
        index: i,
        text: el.textContent?.trim().slice(0, 30) || `element_${i}`,
        tag: el.tagName
      }))
    );

    for (const el of elements) {
      try {
        const selector = `button, a.btn, .button, [role="button"]`;
        const elementHandles = await page.$$(selector);
        if (elementHandles[el.index]) {
          // Hover over element
          await elementHandles[el.index].hover();
          await page.evaluate(() => new Promise(r => setTimeout(r, 300)));

          // Take screenshot
          const hoverFileName = `${fileName}_hover_${el.index}.${format}`;
          const filePath = path.join(dir, hoverFileName);

          await page.screenshot({ path: filePath, type: format });

          let finalFileName = hoverFileName;
          if (compressForAI && optimizeForAI) {
            const optimizedPath = await optimizeForAI(filePath);
            finalFileName = path.basename(optimizedPath);
          }

          results.push({
            type: 'hover',
            element: el.text,
            file: `interactive/${finalFileName}`
          });

          // Move mouse away
          await page.mouse.move(0, 0);
          await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
        }
      } catch (e) {
        console.log(`[Interactive] Hover error for element ${el.index}:`, e.message);
      }
    }
  } catch (e) {
    console.log('[Interactive] Hover capture error:', e.message);
  }

  return results;
}

/**
 * Find and click tabs/accordions
 */
async function captureTabStates(page, options) {
  const { dir, fileName, format, compressForAI, optimizeForAI } = options;
  const results = [];

  try {
    // Common tab selectors
    const tabSelectors = [
      '[role="tab"]',
      '.tab',
      '.tabs button',
      '.tabs a',
      '.nav-tabs a',
      '.nav-tabs button',
      '[data-toggle="tab"]',
      '.accordion-header',
      '.accordion-button',
      '[data-bs-toggle="collapse"]'
    ];

    for (const selector of tabSelectors) {
      const tabs = await page.$$(selector);
      if (tabs.length > 0) {
        for (let i = 0; i < Math.min(tabs.length, 5); i++) {
          try {
            const tabText = await page.evaluate(el => el.textContent?.trim().slice(0, 30), tabs[i]);

            // Click the tab
            await tabs[i].click();
            await page.evaluate(() => new Promise(r => setTimeout(r, 500)));

            // Take screenshot
            const tabFileName = `${fileName}_tab_${i}.${format}`;
            const filePath = path.join(dir, tabFileName);

            await page.screenshot({ path: filePath, type: format });

            let finalFileName = tabFileName;
            if (compressForAI && optimizeForAI) {
              const optimizedPath = await optimizeForAI(filePath);
              finalFileName = path.basename(optimizedPath);
            }

            results.push({
              type: 'tab',
              element: tabText || `tab_${i}`,
              file: `interactive/${finalFileName}`
            });
          } catch (e) {
            console.log(`[Interactive] Tab click error:`, e.message);
          }
        }
        break; // Only process first matching selector
      }
    }
  } catch (e) {
    console.log('[Interactive] Tab capture error:', e.message);
  }

  return results;
}

/**
 * Find and open modals
 */
async function captureModalStates(page, options) {
  const { dir, fileName, format, compressForAI, optimizeForAI } = options;
  const results = [];

  try {
    // Common modal trigger selectors
    const modalTriggers = [
      '[data-toggle="modal"]',
      '[data-bs-toggle="modal"]',
      '[data-modal]',
      'button[data-target^="#"]',
      'a[data-target^="#"]',
      '.modal-trigger',
      '[aria-haspopup="dialog"]'
    ];

    for (const selector of modalTriggers) {
      const triggers = await page.$$(selector);
      if (triggers.length > 0) {
        for (let i = 0; i < Math.min(triggers.length, 3); i++) {
          try {
            const triggerText = await page.evaluate(el => el.textContent?.trim().slice(0, 30), triggers[i]);

            // Click to open modal
            await triggers[i].click();
            await page.evaluate(() => new Promise(r => setTimeout(r, 700)));

            // Check if modal is visible
            const modalVisible = await page.evaluate(() => {
              const modal = document.querySelector('.modal.show, .modal[style*="display: block"], [role="dialog"][aria-hidden="false"]');
              return !!modal;
            });

            if (modalVisible) {
              // Take screenshot
              const modalFileName = `${fileName}_modal_${i}.${format}`;
              const filePath = path.join(dir, modalFileName);

              await page.screenshot({ path: filePath, type: format });

              let finalFileName = modalFileName;
              if (compressForAI && optimizeForAI) {
                const optimizedPath = await optimizeForAI(filePath);
                finalFileName = path.basename(optimizedPath);
              }

              results.push({
                type: 'modal',
                element: triggerText || `modal_${i}`,
                file: `interactive/${finalFileName}`
              });

              // Close modal
              await page.keyboard.press('Escape');
              await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
            }
          } catch (e) {
            console.log(`[Interactive] Modal error:`, e.message);
          }
        }
        break;
      }
    }
  } catch (e) {
    console.log('[Interactive] Modal capture error:', e.message);
  }

  return results;
}

module.exports = { captureInteractive };
