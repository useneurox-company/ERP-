const express = require('express');
const archiver = require('archiver');
const path = require('path');
const fsPromises = require('fs').promises;
const { crawlAndScreenshot } = require('../services/crawler');
const { generateSkeleton, detectSections } = require('../services/skeletonGenerator');
const { findTemplatePages } = require('../services/templatePagesFinder');

const router = express.Router();

/**
 * Generate README.md content for AI understanding
 */
function generateReadme(template, sections) {
  const sectionsList = sections.map(s => {
    const placeholders = Object.values(s.content || {})
      .flat()
      .filter(v => typeof v === 'string' && v.startsWith('['))
      .join(', ');
    return `- **${s.type}** (${s.selector}): ${s.description}\n  Плейсхолдеры: ${placeholders || 'нет'}`;
  }).join('\n');

  return `# Шаблон: ${template.name}

## Источник
${template.source}

## Дата создания
${template.createdAt}

---

## Структура файлов

\`\`\`
${template.id}/
├── README.md          # Этот файл - инструкция для ИИ
├── template.json      # Метаданные и структура шаблона
├── original.png       # Скриншот оригинального сайта
├── skeleton.png       # Скриншот-скелет (контент заменен плейсхолдерами)
├── design-system.json # Цвета, шрифты, отступы сайта
├── html/
│   └── home.html      # HTML код главной страницы
└── assets/            # Изображения и медиа файлы
\`\`\`

---

## Как использовать этот шаблон

### 1. Изучите структуру
Откройте \`template.json\` - там описаны все секции страницы с плейсхолдерами.

### 2. Посмотрите скриншоты
- \`original.png\` - как выглядит оригинальный сайт
- \`skeleton.png\` - структура без контента (серые блоки = места для заполнения)

### 3. Используйте design-system.json
Там находятся цвета, шрифты и стили оригинального сайта.

### 4. Заполните плейсхолдеры
Замените все \`[PLACEHOLDER]\` на реальный контент клиента.

---

## Секции страницы

${sectionsList}

---

## Типы плейсхолдеров

| Плейсхолдер | Назначение |
|-------------|------------|
| \`[LOGO]\` | Логотип компании |
| \`[NAV_ITEM]\` | Пункт навигации |
| \`[HEADLINE]\` | Главный заголовок |
| \`[SUBHEADLINE]\` | Подзаголовок |
| \`[BUTTON_TEXT]\` | Текст кнопки |
| \`[HERO_IMAGE]\` | Главное изображение баннера |
| \`[FEATURE_N]\` | Название преимущества N |
| \`[DESCRIPTION_N]\` | Описание преимущества N |
| \`[ICON]\` | Иконка |
| \`[IMAGE_N]\` | Изображение N в галерее |
| \`[QUOTE_N]\` | Текст отзыва N |
| \`[AUTHOR_N]\` | Автор отзыва N |
| \`[CTA_TITLE]\` | Заголовок призыва к действию |
| \`[CTA_BUTTON]\` | Кнопка призыва к действию |
| \`[PHONE]\` | Телефон |
| \`[EMAIL]\` | Email |
| \`[ADDRESS]\` | Адрес |

---

## Инструкция для ИИ

${template.aiInstructions}

---

*Сгенерировано Creatix WebStudio ScreenCreate*
`;
}

// Store active crawl jobs
const activeJobs = new Map();

// Start crawling
router.post('/start', express.json(), async (req, res) => {
  const {
    url, format, fullPage, includePatterns, maxPages, aiPrompt, compressForAI,
    captureDesktop, captureMobile, captureTablet,
    captureHtml, captureCss, captureMeta,
    captureHover, captureTabs, captureModals,
    captureColors, captureTypography, captureImages,
    parallelTabs, fastMode
  } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const jobId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: 'job_started', jobId });

  const screenshotOptions = {
    format: format || 'png',
    fullPage: fullPage !== false
  };

  // Capture options
  const captureOptions = {
    desktop: captureDesktop !== false,  // default true
    mobile: captureMobile === true,
    tablet: captureTablet === true,
    html: captureHtml === true,
    css: captureCss === true,
    meta: captureMeta === true,
    hover: captureHover === true,
    tabs: captureTabs === true,
    modals: captureModals === true,
    // Design tokens for AI
    colors: captureColors === true,
    typography: captureTypography === true,
    images: captureImages === true
  };

  activeJobs.set(jobId, { status: 'running', startedAt: new Date(), stopped: false });

  try {
    const report = await crawlAndScreenshot(url, {
      screenshotOptions,
      captureOptions,
      includePatterns: includePatterns || [],
      maxPages: maxPages || 0,
      aiPrompt: aiPrompt || null,
      compressForAI: compressForAI || false,
      parallelTabs: parallelTabs || 1,
      fastMode: fastMode || false,
      onProgress: (progress) => {
        sendEvent(progress);
      },
      shouldStop: () => {
        const job = activeJobs.get(jobId);
        return job && job.stopped;
      }
    });

    if (activeJobs.get(jobId)?.stopped) {
      activeJobs.set(jobId, { status: 'stopped', report });
      sendEvent({ type: 'stopped', jobId, report });
    } else {
      activeJobs.set(jobId, { status: 'completed', report });
      sendEvent({ type: 'done', jobId, report });
    }
  } catch (error) {
    activeJobs.set(jobId, { status: 'failed', error: error.message });
    sendEvent({ type: 'fatal_error', error: error.message });
  }

  res.end();
});

// Start multi-site crawling (up to 5 sites in parallel)
router.post('/start-multi', express.json(), async (req, res) => {
  const {
    urls, format, fullPage, includePatterns, maxPages, aiPrompt, compressForAI,
    captureDesktop, captureMobile, captureTablet,
    captureHtml, captureCss, captureMeta,
    captureHover, captureTabs, captureModals,
    captureColors, captureTypography, captureImages,
    parallelTabs, fastMode
  } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  // Validate and limit to 5 URLs
  const validUrls = [];
  for (const url of urls.slice(0, 5)) {
    try {
      new URL(url);
      validUrls.push(url);
    } catch (e) {
      // Skip invalid URLs
    }
  }

  if (validUrls.length === 0) {
    return res.status(400).json({ error: 'No valid URLs provided' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Force disable socket buffering
  if (res.socket) {
    res.socket.setNoDelay(true);
  }

  const sendEvent = (data) => {
    const eventData = `data: ${JSON.stringify(data)}\n\n`;
    console.log(`[SSE Multi] ${data.type}`, data.siteIndex !== undefined ? `site:${data.siteIndex}` : '');
    res.write(eventData);
    // Force flush - write empty comment to ensure data is sent
    res.write(': heartbeat\n\n');
  };

  sendEvent({ type: 'multi_start', totalSites: validUrls.length, urls: validUrls });

  const screenshotOptions = {
    format: format || 'png',
    fullPage: fullPage !== false
  };

  const captureOptions = {
    desktop: captureDesktop !== false,
    mobile: captureMobile === true,
    tablet: captureTablet === true,
    html: captureHtml === true,
    css: captureCss === true,
    meta: captureMeta === true,
    hover: captureHover === true,
    tabs: captureTabs === true,
    modals: captureModals === true,
    colors: captureColors === true,
    typography: captureTypography === true,
    images: captureImages === true
  };

  const results = [];
  const siteStatuses = validUrls.map(() => ({ status: 'pending', pages: 0 }));

  // Crawl all sites in parallel
  await Promise.all(validUrls.map(async (url, siteIndex) => {
    const siteName = new URL(url).hostname;

    try {
      siteStatuses[siteIndex].status = 'running';
      sendEvent({ type: 'site_start', siteIndex, url, siteName });

      const report = await crawlAndScreenshot(url, {
        screenshotOptions,
        captureOptions,
        includePatterns: includePatterns || [],
        maxPages: maxPages || 0,
        aiPrompt: aiPrompt || null,
        compressForAI: compressForAI || false,
        parallelTabs: parallelTabs || 1,
        fastMode: fastMode || false,
        onProgress: (progress) => {
          // Add site identifier to all progress events
          sendEvent({ ...progress, siteIndex, siteName });
          if (progress.type === 'screenshot') {
            siteStatuses[siteIndex].pages = progress.total;
          }
        }
      });

      siteStatuses[siteIndex].status = 'completed';
      results.push({ siteIndex, url, siteName, report, success: true });
      sendEvent({ type: 'site_complete', siteIndex, url, siteName, report });

    } catch (error) {
      siteStatuses[siteIndex].status = 'failed';
      results.push({ siteIndex, url, siteName, error: error.message, success: false });
      sendEvent({ type: 'site_error', siteIndex, url, siteName, error: error.message });
    }
  }));

  // Send final summary
  sendEvent({
    type: 'multi_complete',
    results,
    summary: {
      total: validUrls.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    }
  });

  res.end();
});

// Stop crawling
router.post('/stop/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (job) {
    job.stopped = true;
    activeJobs.set(req.params.jobId, job);
    res.json({ success: true, message: 'Stop signal sent' });
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

// Get job status
router.get('/status/:jobId', (req, res) => {
  const job = activeJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// List all screenshots folders
router.get('/sites', async (req, res) => {
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  try {
    const entries = await fsPromises.readdir(screenshotsDir, { withFileTypes: true });
    const sites = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const reportPath = path.join(screenshotsDir, entry.name, 'report.json');
        try {
          const report = JSON.parse(await fsPromises.readFile(reportPath, 'utf-8'));
          sites.push({
            siteName: entry.name,
            site: report.site,
            crawledAt: report.crawledAt,
            totalPages: report.totalPages
          });
        } catch (e) {
          sites.push({ siteName: entry.name, site: entry.name, totalPages: 0 });
        }
      }
    }

    res.json(sites);
  } catch (error) {
    res.json([]);
  }
});

// Get site report
router.get('/report/:siteName', async (req, res) => {
  const reportPath = path.join(__dirname, '..', 'screenshots', req.params.siteName, 'report.json');

  try {
    const report = JSON.parse(await fsPromises.readFile(reportPath, 'utf-8'));
    res.json(report);
  } catch (error) {
    res.status(404).json({ error: 'Report not found' });
  }
});

// Delete site and all screenshots
router.delete('/delete/:siteName', async (req, res) => {
  const siteName = req.params.siteName;
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', siteName);

  console.log('[DELETE] Deleting site:', siteName, screenshotsDir);

  try {
    await fsPromises.access(screenshotsDir);
    // Use rmdir for older Node.js compatibility
    const fs = require('fs');
    fs.rm(screenshotsDir, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error('[DELETE] Error:', err);
        return res.status(500).json({ error: 'Failed to delete site' });
      }
      console.log('[DELETE] Success');
      res.json({ success: true, message: 'Site deleted' });
    });
  } catch (error) {
    console.error('[DELETE] Access error:', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.status(500).json({ error: 'Failed to delete site' });
  }
});

// Download site as ZIP archive
router.get('/download/:siteName', async (req, res) => {
  const siteName = req.params.siteName;
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', siteName);

  // Check if directory exists
  try {
    await fsPromises.access(screenshotsDir);
  } catch (error) {
    return res.status(404).json({ error: 'Site not found' });
  }

  // Set headers for ZIP download
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${siteName}.zip"`);

  // Create archive
  const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
  });

  // Handle errors
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    res.status(500).json({ error: 'Failed to create archive' });
  });

  // Pipe archive to response
  archive.pipe(res);

  // Add all files from the site folder
  archive.directory(screenshotsDir, siteName);

  // Finalize archive
  archive.finalize();
});

// Create template from crawled site
router.post('/make-template/:siteName', async (req, res) => {
  const siteName = req.params.siteName;
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', siteName);
  const templatesDir = path.join(__dirname, '..', 'templates', siteName);

  console.log('[Template] Creating template for:', siteName);

  try {
    // Check if source exists
    await fsPromises.access(screenshotsDir);

    // Read the report to get source URL
    const reportPath = path.join(screenshotsDir, 'report.json');
    const report = JSON.parse(await fsPromises.readFile(reportPath, 'utf-8'));

    // Create templates directory
    await fsPromises.mkdir(templatesDir, { recursive: true });
    await fsPromises.mkdir(path.join(templatesDir, 'html'), { recursive: true });
    await fsPromises.mkdir(path.join(templatesDir, 'assets'), { recursive: true });

    // Copy design-system.json if exists
    try {
      const designSystemPath = path.join(screenshotsDir, 'design-system.json');
      await fsPromises.copyFile(designSystemPath, path.join(templatesDir, 'design-system.json'));
    } catch (e) {
      console.log('[Template] No design-system.json found');
    }

    // Copy original screenshot (home page)
    const homePage = report.pages.find(p => p.pathname === '/' || p.pathname === '') || report.pages[0];
    if (homePage && homePage.files?.desktop) {
      const originalPath = path.join(screenshotsDir, homePage.files.desktop);
      await fsPromises.copyFile(originalPath, path.join(templatesDir, 'original.png'));
    }

    // Copy HTML if exists
    if (homePage && homePage.files?.html) {
      const htmlPath = path.join(screenshotsDir, homePage.files.html);
      try {
        await fsPromises.copyFile(htmlPath, path.join(templatesDir, 'html', 'home.html'));
      } catch (e) {
        console.log('[Template] No HTML found for home page');
      }
    }

    // Copy assets if exist
    const assetsDir = path.join(screenshotsDir, 'assets');
    try {
      const assets = await fsPromises.readdir(assetsDir);
      for (const asset of assets) {
        await fsPromises.copyFile(
          path.join(assetsDir, asset),
          path.join(templatesDir, 'assets', asset)
        );
      }
    } catch (e) {
      console.log('[Template] No assets folder found');
    }

    // Generate skeleton screenshot
    console.log('[Template] Generating skeleton screenshot...');
    const skeletonPath = path.join(templatesDir, 'skeleton.png');
    await generateSkeleton(report.startUrl, skeletonPath);

    // Detect page sections
    console.log('[Template] Detecting page sections...');
    const sections = await detectSections(report.startUrl);

    // Create template.json with AI-friendly structure
    const template = {
      id: siteName,
      name: report.site,
      source: report.startUrl,
      createdAt: new Date().toISOString(),

      screenshots: {
        original: 'original.png',
        skeleton: 'skeleton.png'
      },

      structure: {
        sections: sections
      },

      html: 'html/home.html',
      designSystem: 'design-system.json',

      aiInstructions: 'Для наполнения шаблона: замените все [PLACEHOLDER] на реальный контент. Секции описаны в structure.sections с указанием типа и назначения. Каждая секция имеет description (описание назначения) и content (структура контента с плейсхолдерами).'
    };

    // Save template.json
    await fsPromises.writeFile(
      path.join(templatesDir, 'template.json'),
      JSON.stringify(template, null, 2)
    );

    // Generate README.md for AI understanding
    console.log('[Template] Generating README.md...');
    const readmeContent = generateReadme(template, sections);
    await fsPromises.writeFile(
      path.join(templatesDir, 'README.md'),
      readmeContent
    );

    console.log('[Template] Template created successfully');

    res.json({
      success: true,
      message: 'Шаблон создан',
      templatePath: templatesDir,
      template: template
    });

  } catch (error) {
    console.error('[Template] Error:', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.status(500).json({ error: 'Failed to create template: ' + error.message });
  }
});

// List all templates
router.get('/templates', async (req, res) => {
  const templatesDir = path.join(__dirname, '..', 'templates');

  try {
    await fsPromises.mkdir(templatesDir, { recursive: true });
    const entries = await fsPromises.readdir(templatesDir, { withFileTypes: true });
    const templates = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const templatePath = path.join(templatesDir, entry.name, 'template.json');
        try {
          const template = JSON.parse(await fsPromises.readFile(templatePath, 'utf-8'));
          templates.push({
            id: template.id,
            name: template.name,
            source: template.source,
            createdAt: template.createdAt,
            sectionsCount: template.structure?.sections?.length || 0
          });
        } catch (e) {
          templates.push({ id: entry.name, name: entry.name });
        }
      }
    }

    res.json(templates);
  } catch (error) {
    res.json([]);
  }
});

// Get template details
router.get('/template/:templateId', async (req, res) => {
  const templatePath = path.join(__dirname, '..', 'templates', req.params.templateId, 'template.json');

  try {
    const template = JSON.parse(await fsPromises.readFile(templatePath, 'utf-8'));
    res.json(template);
  } catch (error) {
    res.status(404).json({ error: 'Template not found' });
  }
});

// Serve template files (screenshots, etc.)
router.get('/template-file/:templateId/:file', async (req, res) => {
  const filePath = path.join(__dirname, '..', 'templates', req.params.templateId, req.params.file);

  try {
    await fsPromises.access(filePath);
    res.sendFile(filePath);
  } catch (error) {
    res.status(404).json({ error: 'File not found' });
  }
});

// Find template pages using AI
router.post('/find-template-pages', express.json(), async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const result = await findTemplatePages(url, {
      maxPagesToCheck: 50,
      onProgress: (progress) => {
        sendEvent(progress);
      }
    });

    sendEvent({ type: 'done', result });
  } catch (error) {
    sendEvent({ type: 'error', error: error.message });
  }

  res.end();
});

// Download template as ZIP
router.get('/download-template/:templateId', async (req, res) => {
  const templateId = req.params.templateId;
  const templatesDir = path.join(__dirname, '..', 'templates', templateId);

  // Check if directory exists
  try {
    await fsPromises.access(templatesDir);
  } catch (error) {
    return res.status(404).json({ error: 'Template not found' });
  }

  // Set headers for ZIP download
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${templateId}-template.zip"`);

  // Create archive
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    res.status(500).json({ error: 'Failed to create archive' });
  });

  archive.pipe(res);
  archive.directory(templatesDir, templateId);
  archive.finalize();
});

module.exports = router;
