/**
 * Design Token Extractor
 * Extracts colors, typography, and other design tokens from a page
 * Output is optimized for AI consumption (Claude, GPT, etc.)
 */

/**
 * Extract all design tokens from a page
 * @param {import('puppeteer').Page} page - Puppeteer page
 * @returns {Promise<Object>} Design tokens
 */
async function extractDesignTokens(page) {
  return await page.evaluate(() => {
    const result = {
      colors: {
        primary: null,
        secondary: null,
        accent: null,
        background: null,
        text: null,
        palette: []
      },
      typography: {
        fonts: [],
        styles: {}
      }
    };

    const colorCounts = {};
    const fontCounts = {};
    const bgColors = {};
    const textColors = {};

    // Helper to convert RGB to HEX
    function rgbToHex(rgb) {
      if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
      const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return rgb;
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    }

    // Helper to check if color is dark
    function isDark(hex) {
      if (!hex || !hex.startsWith('#')) return false;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }

    // Process all elements
    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
      try {
        const style = getComputedStyle(el);

        // Collect colors
        const color = rgbToHex(style.color);
        const bgColor = rgbToHex(style.backgroundColor);
        const borderColor = rgbToHex(style.borderColor);

        if (color && color !== '#000000') {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
          textColors[color] = (textColors[color] || 0) + 1;
        }
        if (bgColor && bgColor !== '#ffffff' && bgColor !== '#000000') {
          colorCounts[bgColor] = (colorCounts[bgColor] || 0) + 1;
          bgColors[bgColor] = (bgColors[bgColor] || 0) + 1;
        }
        if (borderColor && borderColor !== '#000000') {
          colorCounts[borderColor] = (colorCounts[borderColor] || 0) + 1;
        }

        // Collect fonts
        const fontFamily = style.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
        if (fontFamily && !fontFamily.includes('system') && !fontFamily.includes('inherit')) {
          fontCounts[fontFamily] = (fontCounts[fontFamily] || 0) + 1;
        }
      } catch (e) {}
    });

    // Sort colors by frequency
    const sortedColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color)
      .slice(0, 20);

    result.colors.palette = sortedColors;

    // Determine primary colors
    const sortedBgColors = Object.entries(bgColors).sort((a, b) => b[1] - a[1]);
    const sortedTextColors = Object.entries(textColors).sort((a, b) => b[1] - a[1]);

    // Find likely primary color (most used colored background, excluding white/gray)
    for (const [color] of sortedBgColors) {
      if (color && !color.match(/^#[ef]{6}$/i) && !color.match(/^#[0-9a-f]{6}$/i).toString().match(/^#([0-9a-f])\1{5}$/i)) {
        result.colors.primary = color;
        break;
      }
    }

    // Background is likely white or the most common light background
    result.colors.background = '#ffffff';
    for (const [color] of sortedBgColors) {
      if (!isDark(color)) {
        result.colors.background = color;
        break;
      }
    }

    // Text color is likely the most common dark text
    for (const [color] of sortedTextColors) {
      if (isDark(color)) {
        result.colors.text = color;
        break;
      }
    }

    // Secondary and accent from remaining colors
    const usedColors = [result.colors.primary, result.colors.background, result.colors.text];
    const remainingColors = sortedColors.filter(c => !usedColors.includes(c));
    result.colors.secondary = remainingColors[0] || null;
    result.colors.accent = remainingColors[1] || null;

    // Sort fonts by frequency
    result.typography.fonts = Object.entries(fontCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([font]) => font)
      .slice(0, 5);

    // Extract typography styles from headings and body
    const typographyElements = {
      h1: document.querySelector('h1'),
      h2: document.querySelector('h2'),
      h3: document.querySelector('h3'),
      body: document.body
    };

    for (const [tag, el] of Object.entries(typographyElements)) {
      if (el) {
        const style = getComputedStyle(el);
        result.typography.styles[tag] = {
          font: style.fontFamily.split(',')[0].trim().replace(/['"]/g, ''),
          size: style.fontSize,
          weight: parseInt(style.fontWeight) || 400,
          lineHeight: style.lineHeight
        };
      }
    }

    return result;
  });
}

/**
 * Extract colors only
 */
async function extractColors(page) {
  const tokens = await extractDesignTokens(page);
  return tokens.colors;
}

/**
 * Extract typography only
 */
async function extractTypography(page) {
  const tokens = await extractDesignTokens(page);
  return tokens.typography;
}

module.exports = {
  extractDesignTokens,
  extractColors,
  extractTypography
};
