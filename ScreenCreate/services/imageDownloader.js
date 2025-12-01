/**
 * Image Downloader
 * Downloads logos, hero images, and other important images from a website
 */

const path = require('path');
const fs = require('fs').promises;
const https = require('https');
const http = require('http');

/**
 * Extract and download images from a page
 * @param {import('puppeteer').Page} page - Puppeteer page
 * @param {string} assetsDir - Directory to save images
 * @returns {Promise<Array>} List of downloaded images
 */
async function downloadImages(page, assetsDir) {
  // Ensure assets directory exists
  await fs.mkdir(assetsDir, { recursive: true });

  // Extract image info from page
  const images = await page.evaluate(() => {
    const result = [];
    const baseUrl = window.location.origin;

    // Helper to get absolute URL
    function getAbsoluteUrl(src) {
      if (!src) return null;
      if (src.startsWith('data:')) return null; // Skip data URLs
      if (src.startsWith('//')) return 'https:' + src;
      if (src.startsWith('/')) return baseUrl + src;
      if (src.startsWith('http')) return src;
      return baseUrl + '/' + src;
    }

    // Find logos
    const logoSelectors = [
      'img[alt*="logo" i]',
      'img[src*="logo" i]',
      'img[class*="logo" i]',
      '.logo img',
      '#logo img',
      'header img:first-of-type',
      'a[href="/"] img',
      '[class*="brand"] img'
    ];

    for (const selector of logoSelectors) {
      const logos = document.querySelectorAll(selector);
      logos.forEach(img => {
        const src = getAbsoluteUrl(img.src);
        if (src && !result.find(i => i.src === src)) {
          result.push({
            type: 'logo',
            src,
            alt: img.alt || '',
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height
          });
        }
      });
    }

    // Find hero/banner images (large images at top of page)
    const allImages = document.querySelectorAll('img');
    allImages.forEach(img => {
      const src = getAbsoluteUrl(img.src);
      if (!src) return;
      if (result.find(i => i.src === src)) return;

      const rect = img.getBoundingClientRect();
      const isLarge = (img.naturalWidth > 600 || rect.width > 600);
      const isNearTop = rect.top < 800;

      if (isLarge && isNearTop) {
        result.push({
          type: 'hero',
          src,
          alt: img.alt || '',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      }
    });

    // Find favicon
    const favicon = document.querySelector('link[rel*="icon"]');
    if (favicon && favicon.href) {
      result.push({
        type: 'favicon',
        src: getAbsoluteUrl(favicon.href),
        alt: 'Favicon'
      });
    }

    // Find OG image
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.content) {
      const src = getAbsoluteUrl(ogImage.content);
      if (src && !result.find(i => i.src === src)) {
        result.push({
          type: 'og-image',
          src,
          alt: 'Open Graph Image'
        });
      }
    }

    return result.slice(0, 10); // Limit to 10 images
  });

  const downloaded = [];

  for (const img of images) {
    try {
      const fileName = await downloadFile(img.src, assetsDir, img.type);
      if (fileName) {
        downloaded.push({
          type: img.type,
          src: `assets/${fileName}`,
          originalSrc: img.src,
          alt: img.alt
        });
      }
    } catch (e) {
      console.log(`[ImageDownloader] Failed to download ${img.src}:`, e.message);
    }
  }

  return downloaded;
}

/**
 * Download a file from URL
 */
async function downloadFile(url, dir, type) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      // Generate filename
      const ext = path.extname(urlObj.pathname).toLowerCase() || '.png';
      const baseName = type + '_' + Date.now().toString(36);
      const fileName = baseName + ext;
      const filePath = path.join(dir, fileName);

      const file = require('fs').createWriteStream(filePath);

      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      }, response => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          require('fs').unlinkSync(filePath);
          downloadFile(response.headers.location, dir, type)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          require('fs').unlinkSync(filePath);
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(fileName);
        });
      });

      request.on('error', (err) => {
        file.close();
        try { require('fs').unlinkSync(filePath); } catch (e) {}
        reject(err);
      });

      request.on('timeout', () => {
        request.destroy();
        file.close();
        try { require('fs').unlinkSync(filePath); } catch (e) {}
        reject(new Error('Timeout'));
      });

    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  downloadImages
};
