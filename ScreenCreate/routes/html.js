const express = require('express');
const { getPageHtml } = require('../services/browser');

const router = express.Router();

router.get('/', async (req, res) => {
  const { url, waitFor, timeout } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const options = {
      timeout: parseInt(timeout) || 30000,
      waitFor: waitFor || null
    };

    const result = await getPageHtml(url, options);

    res.json({
      success: true,
      url: result.url,
      title: result.title,
      html: result.html,
      length: result.html.length
    });
  } catch (error) {
    console.error('HTML fetch error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch HTML',
      message: error.message
    });
  }
});

module.exports = router;
