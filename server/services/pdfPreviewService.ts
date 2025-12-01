import fs from "fs";
import path from "path";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

const PREVIEWS_DIR = path.join(process.cwd(), ".local", "previews");
const PREVIEW_WIDTH = 400;
const IS_WINDOWS = process.platform === "win32";

// Ensure previews directory exists
if (!fs.existsSync(PREVIEWS_DIR)) {
  fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
}

/**
 * Generates PDF preview using pdf-poppler (Windows) or pdftocairo (Linux)
 */
export async function generatePdfPreview(
  pdfPath: string,
  attachmentId: string
): Promise<string | null> {
  const previewPath = path.join(PREVIEWS_DIR, `${attachmentId}.jpg`);

  // Check if preview already exists
  if (fs.existsSync(previewPath)) {
    console.log(`[PdfPreview] Using cached preview: ${previewPath}`);
    return previewPath;
  }

  // Check if PDF exists
  if (!fs.existsSync(pdfPath)) {
    console.error(`[PdfPreview] PDF file not found: ${pdfPath}`);
    return null;
  }

  console.log(`[PdfPreview] Generating preview for: ${pdfPath}`);

  // On Linux use pdftocairo
  if (!IS_WINDOWS) {
    console.log(`[PdfPreview] Using pdftocairo for Linux...`);
    try {
      return await generatePdfPreviewLinux(pdfPath, attachmentId);
    } catch (error: any) {
      console.error(`[PdfPreview] pdftocairo failed:`, error.message || error);
      return null;
    }
  }

  try {
    // On Windows use pdf-poppler
    const pdfPoppler = await import("pdf-poppler");

    const outputBase = path.join(PREVIEWS_DIR, attachmentId);

    const options = {
      format: "jpeg" as const,
      out_dir: PREVIEWS_DIR,
      out_prefix: attachmentId,
      page: 1,
      scale: PREVIEW_WIDTH,
    };

    console.log(`[PdfPreview] Running pdf-poppler convert...`);
    await pdfPoppler.convert(pdfPath, options);

    const generatedPath = `${outputBase}-1.jpg`;

    if (fs.existsSync(generatedPath)) {
      fs.renameSync(generatedPath, previewPath);
      console.log(`[PdfPreview] Preview generated: ${previewPath}`);
      return previewPath;
    } else {
      console.error(`[PdfPreview] Generated file not found: ${generatedPath}`);
      return null;
    }

  } catch (error: any) {
    console.error(`[PdfPreview] Error generating preview with pdf-poppler:`, error.message || error);

    console.log(`[PdfPreview] Trying PowerShell fallback...`);
    try {
      return await generatePdfPreviewFallback(pdfPath, attachmentId);
    } catch (fallbackError: any) {
      console.error(`[PdfPreview] PowerShell fallback failed:`, fallbackError.message || fallbackError);
      return null;
    }
  }
}

/**
 * Generate PDF preview on Linux using pdftocairo
 */
async function generatePdfPreviewLinux(pdfPath: string, attachmentId: string): Promise<string | null> {
  const previewPath = path.join(PREVIEWS_DIR, `${attachmentId}.jpg`);
  const outputBase = path.join(PREVIEWS_DIR, attachmentId);

  const command = `pdftocairo -jpeg -f 1 -l 1 -scale-to ${PREVIEW_WIDTH} "${pdfPath}" "${outputBase}"`;

  console.log(`[PdfPreview] Running: ${command}`);

  try {
    await execAsync(command, { timeout: 30000 });

    const possiblePaths = [
      `${outputBase}-01.jpg`,
      `${outputBase}-1.jpg`,
      `${outputBase}.jpg`
    ];

    for (const generatedPath of possiblePaths) {
      if (fs.existsSync(generatedPath)) {
        if (generatedPath !== previewPath) {
          fs.renameSync(generatedPath, previewPath);
        }
        console.log(`[PdfPreview] Linux preview generated: ${previewPath}`);
        return previewPath;
      }
    }

    console.error(`[PdfPreview] Generated file not found. Checked: ${possiblePaths.join(', ')}`);
    return null;

  } catch (error: any) {
    console.error(`[PdfPreview] pdftocairo error:`, error.message || error);
    throw error;
  }
}

/**
 * Fallback method using PowerShell on Windows
 */
async function generatePdfPreviewFallback(pdfPath: string, attachmentId: string): Promise<string | null> {
  const previewPath = path.join(PREVIEWS_DIR, `${attachmentId}.jpg`);

  const psScript = `
Add-Type -AssemblyName System.Drawing
$width = ${PREVIEW_WIDTH}
$height = [int]($width * 1.414)
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(240, 240, 240))
$font = New-Object System.Drawing.Font("Arial", 32, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(200, 50, 50))
$graphics.DrawString("PDF", $font, $brush, 130, 200)
$font2 = New-Object System.Drawing.Font("Arial", 14)
$brush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Gray)
$graphics.DrawString("Preview", $font2, $brush2, 150, 260)
$bitmap.Save("${previewPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output "OK"
`.trim();

  const tempScript = path.join(PREVIEWS_DIR, `gen_${attachmentId}.ps1`);
  fs.writeFileSync(tempScript, psScript);

  try {
    await execAsync(
      `powershell -ExecutionPolicy Bypass -File "${tempScript}"`,
      { timeout: 10000 }
    );

    fs.unlinkSync(tempScript);

    if (fs.existsSync(previewPath)) {
      console.log(`[PdfPreview] Fallback preview generated: ${previewPath}`);
      return previewPath;
    }
    return null;
  } catch (error) {
    if (fs.existsSync(tempScript)) {
      fs.unlinkSync(tempScript);
    }
    throw error;
  }
}

/**
 * Get cached preview path or null if not exists
 */
export function getCachedPreviewPath(attachmentId: string): string | null {
  const previewPath = path.join(PREVIEWS_DIR, `${attachmentId}.jpg`);
  if (fs.existsSync(previewPath)) {
    return previewPath;
  }
  return null;
}

/**
 * Delete cached preview
 */
export function deleteCachedPreview(attachmentId: string): boolean {
  const previewPath = path.join(PREVIEWS_DIR, `${attachmentId}.jpg`);
  if (fs.existsSync(previewPath)) {
    fs.unlinkSync(previewPath);
    return true;
  }
  return false;
}
