const express = require('express');
const { takeScreenshot } = require('../services/browser');

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

module.exports = router;
