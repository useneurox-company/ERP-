const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

/**
 * Optimize image for AI (Claude/GPT)
 * - Resize to max 1568px width
 * - Convert to JPEG 80% quality
 * - Max height 2000px
 */
async function optimizeForAI(inputPath) {
  const ext = path.extname(inputPath);
  const baseName = path.basename(inputPath, ext);
  const dir = path.dirname(inputPath);
  const outputPath = path.join(dir, baseName + '.jpg');

  // Get original file size
  const originalStats = await fs.stat(inputPath);
  const originalSize = (originalStats.size / 1024 / 1024).toFixed(2);

  // If input is already jpg, use temp file
  const tempPath = ext.toLowerCase() === '.jpg' || ext.toLowerCase() === '.jpeg'
    ? path.join(dir, baseName + '_temp.jpg')
    : outputPath;

  await sharp(inputPath)
    .resize(1568, 2000, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 80 })
    .toFile(tempPath);

  // Delete original
  await fs.unlink(inputPath);

  // If we used temp file, rename it
  if (tempPath !== outputPath) {
    await fs.rename(tempPath, outputPath);
  }

  // Get new file size
  const newStats = await fs.stat(outputPath);
  const newSize = (newStats.size / 1024 / 1024).toFixed(2);

  console.log(`[AI Compress] ${path.basename(inputPath)}: ${originalSize}MB -> ${newSize}MB`);

  return outputPath;
}

module.exports = { optimizeForAI };
