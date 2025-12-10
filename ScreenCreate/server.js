const express = require('express');
const path = require('path');
const screenshotRoutes = require('./routes/screenshot');
const htmlRoutes = require('./routes/html');
const crawlRoutes = require('./routes/crawl');
const testRoutes = require('./routes/test');
const agentRoutes = require('./routes/agent');

const app = express();
const PORT = 3500;

// JSON body parser for POST requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS for cross-origin requests from frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Static files (UI)
app.use(express.static(path.join(__dirname, 'public')));

// Static for screenshots (to view them)
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ScreenCreate', port: PORT });
});

// Screenshot API
app.use('/screenshot', screenshotRoutes);

// HTML Fetch API
app.use('/html', htmlRoutes);

// Crawler API
app.use('/crawl', crawlRoutes);

// Test API (for browser automation testing like Puppeteer MCP)
app.use('/test', testRoutes);

// AI Agent API (Computer Use style with Puppeteer)
app.use('/agent', agentRoutes);

app.listen(PORT, () => {
  console.log(`ScreenCreate service running on http://localhost:${PORT}`);
  console.log(`Screenshot UI: http://localhost:${PORT}`);
  console.log(`Crawler UI: http://localhost:${PORT}/crawler.html`);
  console.log(`Live Test View: http://localhost:${PORT}/live-view.html`);
});
