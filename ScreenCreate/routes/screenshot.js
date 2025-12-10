const express = require('express');
const { takeScreenshot, takeScreenshotWithAuth } = require('../services/browser');

const router = express.Router();

router.get('/', async (req, res) => {
  const { url, width, height, fullPage, format, quality } = req.query;

  // Validation
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // Parse parameters
  const options = {
    width: parseInt(width) || 1920,
    height: parseInt(height) || 1080,
    fullPage: fullPage === 'true',
    format: ['png', 'jpeg', 'webp'].includes(format) ? format : 'png',
    quality: Math.min(100, Math.max(1, parseInt(quality) || 80))
  };

  // Validate dimensions
  if (options.width < 100 || options.width > 3840) {
    return res.status(400).json({ error: 'Width must be between 100 and 3840' });
  }
  if (options.height < 100 || options.height > 2160) {
    return res.status(400).json({ error: 'Height must be between 100 and 2160' });
  }

  try {
    const screenshot = await takeScreenshot(url, options);

    const contentTypes = {
      png: 'image/png',
      jpeg: 'image/jpeg',
      webp: 'image/webp'
    };

    res.set('Content-Type', contentTypes[options.format]);
    res.send(screenshot);
  } catch (error) {
    console.error('Screenshot error:', error.message);
    res.status(500).json({ error: 'Failed to take screenshot', message: error.message });
  }
});

/**
 * POST /screenshot/auth - Take screenshot with authentication data
 * Body: {
 *   url: string,
 *   width?: number,
 *   height?: number,
 *   fullPage?: boolean,
 *   format?: 'png' | 'jpeg' | 'webp',
 *   quality?: number,
 *   cookies?: Array<{name: string, value: string, domain?: string}>,
 *   localStorage?: Record<string, any>,
 *   sessionStorage?: Record<string, any>
 * }
 *
 * Returns: { screenshot: base64, format: string, width: number, height: number }
 */
router.post('/auth', async (req, res) => {
  try {
    const {
      url,
      width = 1920,
      height = 1080,
      fullPage = false,
      format = 'png',
      quality = 80,
      cookies = [],
      localStorage = {},
      sessionStorage = {}
    } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`[Screenshot] Taking auth screenshot of ${url}`);
    console.log(`[Screenshot] Cookies: ${cookies.length}, localStorage keys: ${Object.keys(localStorage).length}`);

    const result = await takeScreenshotWithAuth(url, {
      width: parseInt(width) || 1920,
      height: parseInt(height) || 1080,
      fullPage: fullPage === true || fullPage === 'true',
      format: ['png', 'jpeg', 'webp'].includes(format) ? format : 'png',
      quality: Math.min(100, Math.max(1, parseInt(quality) || 80)),
      cookies,
      localStorage,
      sessionStorage
    });

    res.json({
      success: true,
      screenshot: result.screenshot,
      format: result.format,
      width: result.width,
      height: result.height
    });
  } catch (error) {
    console.error('[Screenshot] Auth screenshot error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to take screenshot',
      message: error.message
    });
  }
});

module.exports = router;
